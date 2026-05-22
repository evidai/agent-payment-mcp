/**
 * /api/offramp/coincheck — Provider が USDC を JPY に換金する非カストディ動線
 *
 *   POST /api/offramp/coincheck/connect        — API key 登録（暗号化保存）
 *   GET  /api/offramp/coincheck/balance        — Provider の取引所残高（JPY/USDC）
 *   POST /api/offramp/coincheck/sell           — USDC 成行売却 → JPY 化
 *   POST /api/offramp/coincheck/withdraw       — JPY 銀行口座出金
 *   GET  /api/offramp/coincheck/transactions   — 履歴
 *
 * 重要: LemonCake は USDC を一切持たない。
 *   - Provider が自分の取引所アカウントに自分のウォレットから USDC を送る
 *   - その後 LemonCake が「Provider の API key で」 sell + withdraw を叩く
 *   - 取引主体は Provider、LemonCake はトリガー実行のみ
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { prisma } from "../lib/prisma.js";
import { encrypt, decrypt } from "../lib/crypto-aes.js";
import {
  getBalance as coincheckGetBalance,
  marketSellUsdc as coincheckSellUsdc,
  withdrawJpy as coincheckWithdraw,
  type CoincheckCredentials,
} from "../lib/coincheck.js";
import { resolvePlanFromName } from "../lib/plans.js";
import { Decimal } from "@prisma/client/runtime/library";

export const offrampRouter = new OpenAPIHono();

async function loadCredentials(providerV2Id: string): Promise<{
  creds:      CoincheckCredentials;
  connection: { id: string; bankAccountRef: string | null };
} | { error: "no_connection" } | { error: "plan_locked" }> {
  const provider = await prisma.providerV2.findUnique({
    where: { id: providerV2Id },
    include: { subscription: true },
  });
  if (!provider) return { error: "no_connection" };

  // プラン gate: Business 以上のみ JPY オフランプを許可
  const planName = provider.subscription?.status === "ACTIVE" ? provider.subscription.plan : "FREE";
  if (!resolvePlanFromName(planName).features.jpyOfframp) {
    return { error: "plan_locked" };
  }

  const conn = await prisma.offrampConnection.findUnique({
    where: { providerV2Id_exchange: { providerV2Id, exchange: "COINCHECK" } },
  });
  if (!conn || !conn.active) return { error: "no_connection" };

  return {
    creds: {
      apiKey:    decrypt(conn.encryptedApiKey),
      apiSecret: decrypt(conn.encryptedApiSecret),
    },
    connection: { id: conn.id, bankAccountRef: conn.bankAccountRef },
  };
}

// ─── POST /api/offramp/coincheck/connect ───────────────────────

const ConnectBody = z.object({
  providerV2Id:       z.string().min(1),
  apiKey:             z.string().min(8),
  apiSecret:          z.string().min(8),
  bankAccountRef:     z.string().optional(),   // Coincheck 側の登録銀行口座 ID
  autoThresholdUsdc:  z.string().regex(/^\d+(\.\d{1,6})?$/).optional(),
});

offrampRouter.openapi(
  createRoute({
    method:  "post",
    path:    "/coincheck/connect",
    tags:    ["Offramp"],
    summary: "Coincheck API key 登録（暗号化保存）",
    request: { body: { content: { "application/json": { schema: ConnectBody } }, required: true } },
    responses: {
      200: { content: { "application/json": { schema: z.object({ ok: z.boolean(), connectionId: z.string() }) } }, description: "Connected" },
      400: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Bad Request" },
      403: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Plan locked" },
      404: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Not found" },
      503: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Crypto key not configured" },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const body = c.req.valid("json");
    const provider = await prisma.providerV2.findUnique({
      where: { id: body.providerV2Id },
      include: { subscription: true },
    });
    if (!provider) return c.json({ error: "Provider not found" }, 404);

    const planName = provider.subscription?.status === "ACTIVE" ? provider.subscription.plan : "FREE";
    if (!resolvePlanFromName(planName).features.jpyOfframp) {
      return c.json({ error: "JPY off-ramp requires Business plan or higher" }, 403);
    }

    // 軽い疎通テスト: 残高を取って成功すれば API key が生きてる
    try {
      await coincheckGetBalance({ apiKey: body.apiKey, apiSecret: body.apiSecret });
    } catch (e) {
      return c.json({ error: `Coincheck auth failed: ${e instanceof Error ? e.message : String(e)}` }, 400);
    }

    let encryptedApiKey: string, encryptedApiSecret: string;
    try {
      encryptedApiKey    = encrypt(body.apiKey);
      encryptedApiSecret = encrypt(body.apiSecret);
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "encryption failed" }, 503);
    }

    const conn = await prisma.offrampConnection.upsert({
      where:  { providerV2Id_exchange: { providerV2Id: body.providerV2Id, exchange: "COINCHECK" } },
      update: {
        encryptedApiKey, encryptedApiSecret,
        bankAccountRef:     body.bankAccountRef ?? null,
        autoThresholdUsdc:  body.autoThresholdUsdc ?? null,
        active: true,
      },
      create: {
        providerV2Id:       body.providerV2Id,
        exchange:           "COINCHECK",
        encryptedApiKey, encryptedApiSecret,
        bankAccountRef:     body.bankAccountRef ?? null,
        autoThresholdUsdc:  body.autoThresholdUsdc ?? null,
      },
    });

    return c.json({ ok: true, connectionId: conn.id });
  },
);

// ─── GET /api/offramp/coincheck/balance?providerV2Id=… ─────────

offrampRouter.openapi(
  createRoute({
    method:  "get",
    path:    "/coincheck/balance",
    tags:    ["Offramp"],
    summary: "Provider の取引所残高",
    request: { query: z.object({ providerV2Id: z.string().min(1) }) },
    responses: {
      200: {
        content: { "application/json": { schema: z.object({
          jpy:  z.string(),
          usdc: z.string().optional(),
        }) } },
        description: "Balance",
      },
      403: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Plan locked" },
      404: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Not connected" },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const { providerV2Id } = c.req.valid("query");
    const loaded = await loadCredentials(providerV2Id);
    if ("error" in loaded) {
      if (loaded.error === "plan_locked") return c.json({ error: "JPY off-ramp requires Business plan" }, 403);
      return c.json({ error: "Coincheck not connected for this provider" }, 404);
    }
    try {
      const b = await coincheckGetBalance(loaded.creds);
      return c.json({ jpy: b.jpy, usdc: b.usdc ?? "0" });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "balance fetch failed" }, 502);
    }
  },
);

// ─── POST /api/offramp/coincheck/sell ─────────────────────────

const SellBody = z.object({
  providerV2Id: z.string().min(1),
  amountUsdc:   z.string().regex(/^\d+(\.\d{1,6})?$/),
});

offrampRouter.openapi(
  createRoute({
    method:  "post",
    path:    "/coincheck/sell",
    tags:    ["Offramp"],
    summary: "USDC 成行売却（JPY 化）",
    request: { body: { content: { "application/json": { schema: SellBody } }, required: true } },
    responses: {
      200: { content: { "application/json": { schema: z.object({ transactionId: z.string(), orderId: z.number(), amountUsdc: z.string() }) } }, description: "Sold" },
      403: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Plan locked" },
      404: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Not connected" },
      502: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Exchange error" },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const body = c.req.valid("json");
    const loaded = await loadCredentials(body.providerV2Id);
    if ("error" in loaded) {
      if (loaded.error === "plan_locked") return c.json({ error: "JPY off-ramp requires Business plan" }, 403);
      return c.json({ error: "Coincheck not connected" }, 404);
    }

    const tx = await prisma.offrampTransaction.create({
      data: {
        providerV2Id: body.providerV2Id,
        exchange:     "COINCHECK",
        usdcAmount:   body.amountUsdc,
        status:       "PENDING",
      },
    });

    try {
      const order = await coincheckSellUsdc(loaded.creds, body.amountUsdc);
      const updated = await prisma.offrampTransaction.update({
        where: { id: tx.id },
        data: {
          sellOrderId: String(order.id),
          status:      "SOLD",
        },
      });
      return c.json({ transactionId: updated.id, orderId: order.id, amountUsdc: body.amountUsdc });
    } catch (e) {
      await prisma.offrampTransaction.update({
        where: { id: tx.id },
        data:  { status: "FAILED", failureReason: e instanceof Error ? e.message : String(e) },
      });
      return c.json({ error: e instanceof Error ? e.message : "sell failed" }, 502);
    }
  },
);

// ─── POST /api/offramp/coincheck/withdraw ─────────────────────

const WithdrawBody = z.object({
  providerV2Id: z.string().min(1),
  amountJpy:    z.number().int().positive(),
  bankAccountId:z.number().int().positive().optional(),
});

offrampRouter.openapi(
  createRoute({
    method:  "post",
    path:    "/coincheck/withdraw",
    tags:    ["Offramp"],
    summary: "JPY を Provider の銀行口座へ出金",
    request: { body: { content: { "application/json": { schema: WithdrawBody } }, required: true } },
    responses: {
      200: { content: { "application/json": { schema: z.object({ transactionId: z.string(), withdrawalId: z.number(), amountJpy: z.number() }) } }, description: "Withdrawn" },
      400: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Bad Request" },
      403: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Plan locked" },
      404: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Not connected" },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const body = c.req.valid("json");
    const loaded = await loadCredentials(body.providerV2Id);
    if ("error" in loaded) {
      if (loaded.error === "plan_locked") return c.json({ error: "JPY off-ramp requires Business plan" }, 403);
      return c.json({ error: "Coincheck not connected" }, 404);
    }

    const bankAccountId = body.bankAccountId
      ?? (loaded.connection.bankAccountRef ? Number(loaded.connection.bankAccountRef) : null);
    if (!bankAccountId || Number.isNaN(bankAccountId)) {
      return c.json({ error: "bankAccountId required (or register one in /coincheck/connect)" }, 400);
    }

    const tx = await prisma.offrampTransaction.create({
      data: {
        providerV2Id: body.providerV2Id,
        exchange:     "COINCHECK",
        usdcAmount:   new Decimal(0),  // withdraw 単独ジョブ
        withdrawnJpy: body.amountJpy,
        bankAccountRef: String(bankAccountId),
        status:       "PENDING",
      },
    });

    try {
      const w = await coincheckWithdraw(loaded.creds, body.amountJpy, bankAccountId);
      const updated = await prisma.offrampTransaction.update({
        where: { id: tx.id },
        data: {
          withdrawalId: String(w.id),
          status:       "WITHDRAWN",
          completedAt:  new Date(),
        },
      });
      return c.json({ transactionId: updated.id, withdrawalId: w.id, amountJpy: body.amountJpy });
    } catch (e) {
      await prisma.offrampTransaction.update({
        where: { id: tx.id },
        data:  { status: "FAILED", failureReason: e instanceof Error ? e.message : String(e) },
      });
      return c.json({ error: e instanceof Error ? e.message : "withdraw failed" }, 502);
    }
  },
);

// ─── GET /api/offramp/coincheck/transactions?providerV2Id=… ────

offrampRouter.openapi(
  createRoute({
    method:  "get",
    path:    "/coincheck/transactions",
    tags:    ["Offramp"],
    summary: "オフランプ履歴",
    request: { query: z.object({
      providerV2Id: z.string().min(1),
      limit:        z.coerce.number().int().min(1).max(100).default(50),
    }) },
    responses: {
      200: { content: { "application/json": { schema: z.array(z.object({
        id:             z.string(),
        usdcAmount:     z.string(),
        jpyReceived:    z.string().nullable(),
        withdrawnJpy:   z.string().nullable(),
        sellOrderId:    z.string().nullable(),
        withdrawalId:   z.string().nullable(),
        status:         z.string(),
        failureReason:  z.string().nullable(),
        createdAt:      z.string(),
        completedAt:    z.string().nullable(),
      })) } }, description: "Transactions" },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const { providerV2Id, limit } = c.req.valid("query");
    const rows = await prisma.offrampTransaction.findMany({
      where: { providerV2Id, exchange: "COINCHECK" },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return c.json(rows.map(r => ({
      id:             r.id,
      usdcAmount:     r.usdcAmount.toString(),
      jpyReceived:    r.jpyReceived?.toString() ?? null,
      withdrawnJpy:   r.withdrawnJpy?.toString() ?? null,
      sellOrderId:    r.sellOrderId,
      withdrawalId:   r.withdrawalId,
      status:         r.status,
      failureReason:  r.failureReason,
      createdAt:      r.createdAt.toISOString(),
      completedAt:    r.completedAt?.toISOString() ?? null,
    })));
  },
);
