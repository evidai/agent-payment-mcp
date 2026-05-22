/**
 * POST /api/charges/permit — ERC-2612 permit ベース課金
 *
 * v2 非カストディフロー。LemonCake は USDC を一切預からない。
 *
 * リクエスト:
 *   - permit: { owner, spender, value, deadline, v, r, s }
 *   - serviceId: ProviderV2 に紐付く識別子
 *   - amountUsdc: 実際の課金額（"0.005" 等）
 *   - idempotencyKey: 重複課金防止 UUID
 *
 * 処理フロー:
 *   1. idempotencyKey で重複チェック（既存なら即返却）
 *   2. ProviderV2 から受取ウォレットを取得
 *   3. メータリング: 月間 call 数チェック（freeCallsPerMonth 超過で課金）
 *   4. PermitCharge を PENDING で作成
 *   5. permit() + transferFrom() を Base 上で実行
 *   6. PermitCharge を COMPLETED / FAILED に更新
 *
 * メータリングロジック（Pattern 4）:
 *   - 月間 freeCallsPerMonth 以下: 無課金（amountUsdc = 0 で記録）
 *   - 超過分: pricePerCallUsdc を徴収
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { prisma } from "../lib/prisma.js";
import { executePermitTransfer, type PermitParams } from "../lib/usdc-base-permit.js";
import { resolvePlanFromName } from "../lib/plans.js";
import { type Address, type Hex, parseUnits } from "viem";

export const chargesPermitRouter = new OpenAPIHono();

// ─── Zod スキーマ ─────────────────────────────────────────────

const PermitParamsSchema = z.object({
  owner:    z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  spender:  z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  value:    z.string(),    // bigint as string
  deadline: z.string(),    // bigint as string
  v:        z.number().int().min(0).max(255),
  r:        z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  s:        z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

const ChargePermitBody = z.object({
  permit:         PermitParamsSchema,
  serviceId:      z.string().min(1),
  amountUsdc:     z.string().regex(/^\d+(\.\d{1,6})?$/),
  idempotencyKey: z.string().uuid(),
});

const ChargePermitResponse = z.object({
  chargeId:       z.string(),
  status:         z.enum(["PENDING", "COMPLETED", "FAILED"]),
  amountUsdc:     z.string(),
  permitTxHash:   z.string().nullable(),
  transferTxHash: z.string().nullable(),
  quotaRemaining: z.number().int(),   // 今月の残り無料 call 数
  createdAt:      z.string(),
});

// ─── POST /api/charges/permit ────────────────────────────────

chargesPermitRouter.openapi(
  createRoute({
    method:  "post",
    path:    "/",
    tags:    ["Charges"],
    summary: "permit ベース課金（v2 非カストディ）",
    request: {
      headers: z.object({
        "idempotency-key": z.string().uuid().optional(),
      }),
      body: {
        content: { "application/json": { schema: ChargePermitBody } },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: ChargePermitResponse } },
        description: "課金成功（既存レコードの返却も含む）",
      },
      400: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Bad Request" },
      404: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Service Not Found" },
      500: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Server Error" },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const body = c.req.valid("json");
    const { permit, serviceId, amountUsdc, idempotencyKey } = body;

    // ── Provider v2 取得 + プラン解決 ────────────────────────
    // subscription を include して plan-based quota / overage を解決する
    const provider = await prisma.providerV2.findUnique({
      where: { id: serviceId },
      include: { subscription: true },
    });
    if (!provider) {
      return c.json({ error: `Provider not found: ${serviceId}` }, 404);
    }
    if (!provider.active) {
      return c.json({ error: "Provider is suspended" }, 400);
    }

    // プラン解決: subscription が無い / 非 ACTIVE なら FREE 扱い
    const planName = provider.subscription?.status === "ACTIVE"
      ? provider.subscription.plan
      : "FREE";
    const planCfg = resolvePlanFromName(planName);

    // ── メータリング: 今月の call 数（冪等性チェック前に計算）─
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthlyCallCount = await prisma.permitCharge.count({
      where: {
        ownerAddress: permit.owner,
        serviceId,
        createdAt: { gte: monthStart },
        status: "COMPLETED",
      },
    });

    const quotaRemaining = Math.max(0, planCfg.freeCallsPerMonth - monthlyCallCount);
    const isFree = monthlyCallCount < planCfg.freeCallsPerMonth;

    // ── 冪等性チェック ────────────────────────────────────────
    // 既存レコードがある場合は現在のクォータを計算し直して返す
    const existing = await prisma.permitCharge.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return c.json({
        chargeId:       existing.id,
        status:         existing.status,
        amountUsdc:     existing.amountUsdc.toString(),
        permitTxHash:   null,
        transferTxHash: existing.txHash ?? null,
        quotaRemaining,   // 再計算した最新値
        createdAt:      existing.createdAt.toISOString(),
      });
    }

    // 無料枠内なら 0、超過分は Provider が /sellers で設定した単価で課金。
    // プランは無料枠と機能の解放だけ制御する（per-call は 100% Provider へ）。
    const effectiveAmount = isFree ? "0" : provider.pricePerCallUsdc.toString();

    // ── PermitCharge レコード作成（PENDING）──────────────────
    const charge = await prisma.permitCharge.create({
      data: {
        ownerAddress:   permit.owner,
        serviceId,
        amountUsdc:     effectiveAmount,
        status:         "PENDING",
        idempotencyKey,
      },
    });

    // 無料枠内なら on-chain 実行不要
    if (isFree) {
      const updated = await prisma.permitCharge.update({
        where: { id: charge.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      return c.json({
        chargeId:       updated.id,
        status:         "COMPLETED",
        amountUsdc:     "0",
        permitTxHash:   null,
        transferTxHash: null,
        quotaRemaining: Math.max(0, quotaRemaining - 1),
        createdAt:      updated.createdAt.toISOString(),
      });
    }

    // ── 有料: Base 上で permit + transferFrom を実行 ──────────
    try {
      const permitParams: PermitParams = {
        owner:    permit.owner    as Address,
        spender:  permit.spender  as Address,
        value:    BigInt(permit.value),
        deadline: BigInt(permit.deadline),
        v:        permit.v,
        r:        permit.r as Hex,
        s:        permit.s as Hex,
      };

      // overage の単価で transferFrom（client の amountUsdc は無視）
      const amountRaw = parseUnits(effectiveAmount, 6);

      const { permitTxHash, transferTxHash } = await executePermitTransfer({
        permit:    permitParams,
        toAddress: provider.baseWalletAddress as Address,
        amountRaw,
      });

      const completed = await prisma.permitCharge.update({
        where: { id: charge.id },
        data: {
          status:         "COMPLETED",
          txHash:         transferTxHash,
          completedAt:    new Date(),
        },
      });

      return c.json({
        chargeId:       completed.id,
        status:         "COMPLETED",
        amountUsdc:     effectiveAmount,
        permitTxHash:   permitTxHash,
        transferTxHash: transferTxHash,
        quotaRemaining: 0,   // 有料パス = 無料枠は既に 0

        createdAt:      completed.createdAt.toISOString(),
      });
    } catch (err) {
      await prisma.permitCharge.update({
        where: { id: charge.id },
        data: {
          status:        "FAILED",
          failureReason: err instanceof Error ? err.message : String(err),
        },
      });
      console.error("[ChargesPermit] execution failed:", err);
      // 503 = retriable (network/RPC issue). Client should retry with same idempotencyKey.
      return c.json({ error: "On-chain execution failed — please retry" }, 503);
    }
  },
);

// ─── GET /api/charges/permit/quota ───────────────────────────
// owner + serviceId の今月の残り無料 call 数を返す

chargesPermitRouter.openapi(
  createRoute({
    method:  "get",
    path:    "/quota",
    tags:    ["Charges"],
    summary: "残り無料 call 数を取得（メータリング確認用）",
    request: {
      query: z.object({
        ownerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        serviceId:    z.string().min(1),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              monthlyCallCount:  z.number(),
              freeCallsPerMonth: z.number(),
              quotaRemaining:    z.number(),
              pricePerCallUsdc:  z.string(),
            }),
          },
        },
        description: "クォータ情報",
      },
      404: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Not Found" },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const { ownerAddress, serviceId } = c.req.valid("query");

    const provider = await prisma.providerV2.findUnique({ where: { id: serviceId } });
    if (!provider) return c.json({ error: "Provider not found" }, 404);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthlyCallCount = await prisma.permitCharge.count({
      where: {
        ownerAddress,
        serviceId,
        createdAt: { gte: monthStart },
        status: "COMPLETED",
      },
    });

    return c.json({
      monthlyCallCount,
      freeCallsPerMonth: provider.freeCallsPerMonth,
      quotaRemaining:    Math.max(0, provider.freeCallsPerMonth - monthlyCallCount),
      pricePerCallUsdc:  provider.pricePerCallUsdc.toString(),
    });
  },
);
