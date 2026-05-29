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
import { type Address, type Hex, parseUnits, getAddress, isAddress } from "viem";
import { Decimal } from "@prisma/client/runtime/library";

// ─── 手数料設定（売れた時だけ徴収。初回無料枠を超えたコールに適用）──────
//   LEMONCAKE_FEE_BPS       手数料率 bps（デフォルト 300 = 3%）
//   LEMONCAKE_FEE_WALLET    手数料受取ウォレット（Base, 0x...）。未設定なら徴収しない
//   LEMONCAKE_MIN_FEE_USDC  手数料の下限しきい値（デフォルト 0.001 USDC）。
//                           算出手数料がこれ未満なら、ガス代割れ回避のため徴収をスキップ。
function feeConfig() {
  const bps    = parseInt(process.env.LEMONCAKE_FEE_BPS ?? "300", 10);
  const wallet = process.env.LEMONCAKE_FEE_WALLET;
  const minFee = new Decimal(process.env.LEMONCAKE_MIN_FEE_USDC ?? "0.001");
  const validBps    = Number.isFinite(bps) && bps >= 0 && bps <= 10000 ? bps : 300;
  const validWallet = wallet && isAddress(wallet) ? (getAddress(wallet) as Address) : null;
  return { bps: validBps, wallet: validWallet, minFee };
}

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

    // ── メータリング: セラー（serviceId）の通算 call 数（冪等性チェック前に計算）─
    //   料金モデル: セラーごとに「初回 freeCallsPerMonth コールだけ無料」（一度きり・
    //   月リセットなし・全バイヤー合算）。それ以降は pricePerCallUsdc を徴収し、
    //   うち手数料 bps を LemonCake が受け取る（97% セラー / 3% LemonCake）。
    const sellerCallCount = await prisma.permitCharge.count({
      where: {
        serviceId,
        status: "COMPLETED",
      },
    });

    const quotaRemaining = Math.max(0, planCfg.freeCallsPerMonth - sellerCallCount);
    const isFree = sellerCallCount < planCfg.freeCallsPerMonth;

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

    // ── 手数料計算（売れた時だけ徴収）──────────────────────────
    //   total（= pricePerCallUsdc）を 97% セラー / 3% LemonCake に分割。
    //   算出手数料が下限しきい値未満、または受取ウォレット未設定なら徴収せず
    //   100% セラーへ（極小単価でガス代割れの赤字送金を避ける）。
    const { bps: feeBps, wallet: feeWallet, minFee } = feeConfig();
    const totalDecimal = new Decimal(effectiveAmount);
    let feeDecimal     = totalDecimal.mul(feeBps).div(10000).toDecimalPlaces(6, Decimal.ROUND_DOWN);
    const takeFee      = !!feeWallet && feeDecimal.gte(minFee);
    if (!takeFee) feeDecimal = new Decimal(0);
    const providerDecimal = totalDecimal.sub(feeDecimal);

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

      // overage の単価を 97/3 に分割して transferFrom（client の amountUsdc は無視）
      const amountRaw = parseUnits(providerDecimal.toFixed(6), 6);
      const feeRaw    = takeFee ? parseUnits(feeDecimal.toFixed(6), 6) : 0n;

      const { permitTxHash, transferTxHash, feeTxHash } = await executePermitTransfer({
        permit:       permitParams,
        toAddress:    provider.baseWalletAddress as Address,
        amountRaw,
        feeAddress:   takeFee ? feeWallet! : undefined,
        feeAmountRaw: feeRaw,
      });

      const completed = await prisma.permitCharge.update({
        where: { id: charge.id },
        data: {
          status:         "COMPLETED",
          txHash:         transferTxHash,
          feeUsdc:        feeDecimal,
          feeTxHash:      feeTxHash,
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
    // ownerAddress はクエリ互換のため残すが、通算セラー単位の集計では未使用。
    const { serviceId } = c.req.valid("query");

    const provider = await prisma.providerV2.findUnique({
      where: { id: serviceId },
      include: { subscription: true },
    });
    if (!provider) return c.json({ error: "Provider not found" }, 404);

    // 無料枠は課金判定と同一ソース（planCfg）から算出し、表示=実挙動を一致させる。
    const planName = provider.subscription?.status === "ACTIVE"
      ? provider.subscription.plan
      : "FREE";
    const planCfg = resolvePlanFromName(planName);

    // 通算セラー単位の COMPLETED 件数（課金判定と同一ロジック。月リセットなし・
    // 全バイヤー合算）。レスポンスの monthlyCallCount は互換維持のため名前据え置き。
    const sellerCallCount = await prisma.permitCharge.count({
      where: {
        serviceId,
        status: "COMPLETED",
      },
    });

    return c.json({
      monthlyCallCount:  sellerCallCount,
      freeCallsPerMonth: planCfg.freeCallsPerMonth,
      quotaRemaining:    Math.max(0, planCfg.freeCallsPerMonth - sellerCallCount),
      pricePerCallUsdc:  provider.pricePerCallUsdc.toString(),
    });
  },
);

// ─────────────────────────────────────────────────────────────
// GET /api/charges/permit/by-owner — buyer ダッシュボード用の
// 自分の課金履歴取得。auth は wallet 所有のシグネチャ要件にする予定だが
// 当面 wallet アドレスだけで照会可能（PermitCharge は元々 on-chain で
// 公開情報なので、Basescan で見えるのと同等の情報レベル）。
// ─────────────────────────────────────────────────────────────
const ChargeRowSchema = z.object({
  id:           z.string(),
  serviceId:    z.string(),
  serviceName:  z.string().nullable(),
  amountUsdc:   z.string(),
  status:       z.enum(["PENDING", "COMPLETED", "FAILED"]),
  txHash:       z.string().nullable(),
  createdAt:    z.string(),
  completedAt:  z.string().nullable(),
});

chargesPermitRouter.openapi(
  createRoute({
    method:  "get",
    path:    "/by-owner",
    tags:    ["Charges"],
    summary: "Buyer ダッシュボード用：自分の課金履歴",
    description:
      "指定 ownerAddress（permit owner）に紐づく PermitCharge を新しい順に返す。" +
      "Buyer dashboard (/me) から呼ばれる。providerV2.name も埋めて返す。",
    request: {
      query: z.object({
        ownerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        limit:        z.coerce.number().int().min(1).max(200).default(50),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              ownerAddress: z.string(),
              totalCount:   z.number().int(),
              totalUsdc:    z.string(),
              charges:      z.array(ChargeRowSchema),
            }),
          },
        },
        description: "課金履歴",
      },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const { ownerAddress, limit } = c.req.valid("query");
    const owner = ownerAddress.toLowerCase();

    const rows = await prisma.permitCharge.findMany({
      where:   { ownerAddress: { equals: owner, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      take:    limit,
    });

    // providerV2.name を 1 回の findMany で埋める
    const serviceIds = [...new Set(rows.map(r => r.serviceId))];
    const providers = serviceIds.length === 0 ? [] : await prisma.providerV2.findMany({
      where:  { id: { in: serviceIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(providers.map(p => [p.id, p.name]));

    // 累計（status COMPLETED のみ）
    const completedTotal = await prisma.permitCharge.aggregate({
      where:   { ownerAddress: { equals: owner, mode: "insensitive" }, status: "COMPLETED" },
      _sum:    { amountUsdc: true },
      _count:  true,
    });

    return c.json({
      ownerAddress: owner,
      totalCount:   completedTotal._count,
      totalUsdc:    (completedTotal._sum.amountUsdc ?? 0).toString(),
      charges: rows.map(r => ({
        id:          r.id,
        serviceId:   r.serviceId,
        serviceName: nameById.get(r.serviceId) ?? null,
        amountUsdc:  r.amountUsdc.toString(),
        status:      r.status,
        txHash:      r.txHash,
        createdAt:   r.createdAt.toISOString(),
        completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      })),
    });
  },
);
