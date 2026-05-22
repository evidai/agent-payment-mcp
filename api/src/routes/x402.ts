/**
 * /api/x402 — x402 ("HTTP 402 Payment Required") 互換 facilitator
 *
 * x402 仕様 (https://www.x402.org/):
 *   1. Provider が未払いリクエストに 402 + accepts[] を返す
 *   2. クライアント (AI エージェント) が ERC-3009 transferWithAuthorization を
 *      EIP-712 で署名し、X-PAYMENT ヘッダに base64 で載せて再リクエスト
 *   3. Provider は LemonCake の facilitator に検証依頼
 *   4. Facilitator が署名検証 + on-chain 実行 → ok=true 返却
 *   5. Provider が API 応答返却
 *
 *   Facilitator (LemonCake) endpoints:
 *     POST /api/x402/accepts    — Provider が「自分の serviceId にこの価格で」と
 *                                 accepts オブジェクトを取得する補助 (UX 用)
 *     POST /api/x402/verify     — X-PAYMENT 検証 + on-chain 実行
 *     POST /api/x402/settle     — verify と同義（仕様の別名）
 *
 *   Discovery 経由で Coinbase Bazaar / AWS AgentCore から発見される。
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { prisma } from "../lib/prisma.js";
import { resolvePlanFromName } from "../lib/plans.js";
import {
  executeTransferWithAuthorization,
  BASE_USDC_ADDRESS,
} from "../lib/usdc-base-permit.js";
import { type Address, type Hex } from "viem";

export const x402Router = new OpenAPIHono();

// x402 が要求する数値型: USDC base units (6 decimals) の string 整数
const X402_NETWORK = "base-mainnet";
const MARKETPLACE_SPENDER = "0x23e0D435b62d8eABE2b239c461Ec6fb2E8B7E965" as Address;

// ─── POST /api/x402/accepts ────────────────────────────────────
// Provider が serviceId と URL を渡すと、適切な x402 accepts[] を組み立てて返す。
// Provider の middleware は何も計算せずにこれをそのまま 402 レスポンスに載せる。

const AcceptsBody = z.object({
  serviceId:   z.string().min(1),
  resourceUrl: z.string().url(),
  description: z.string().optional(),
});

x402Router.openapi(
  createRoute({
    method:  "post",
    path:    "/accepts",
    tags:    ["x402"],
    summary: "Provider の serviceId に対する x402 accepts[] を生成",
    request: { body: { content: { "application/json": { schema: AcceptsBody } }, required: true } },
    responses: {
      200: { content: { "application/json": { schema: z.object({
        x402Version: z.number(),
        accepts:     z.array(z.any()),
      }) } }, description: "Accepts" },
      404: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Not found" },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const body = c.req.valid("json");
    const provider = await prisma.providerV2.findUnique({
      where: { id: body.serviceId },
      include: { subscription: true },
    });
    if (!provider) return c.json({ error: "Provider not found" }, 404);

    // 現プランの overage が x402 max amount として使われる
    const planName = provider.subscription?.status === "ACTIVE" ? provider.subscription.plan : "FREE";
    const planCfg = resolvePlanFromName(planName);
    const maxAmountUsdc = planCfg.overagePerCallUsdc;       // e.g. "0.001"
    const maxAmountRaw  = String(Math.round(parseFloat(maxAmountUsdc) * 1_000_000)); // micro-USDC

    return c.json({
      x402Version: 1,
      accepts: [{
        scheme:            "exact",
        network:           X402_NETWORK,
        maxAmountRequired: maxAmountRaw,
        resource:          body.resourceUrl,
        description:       body.description ?? `LemonCake-mediated API call on ${provider.name}`,
        mimeType:          "application/json",
        payTo:             MARKETPLACE_SPENDER,
        maxTimeoutSeconds: 60,
        asset:             BASE_USDC_ADDRESS,
        extra: {
          name:      "USD Coin",
          version:   "2",
          providerId: provider.id,
          providerName: provider.name,
        },
      }],
    });
  },
);

// ─── POST /api/x402/verify  (alias: /settle) ──────────────────
// X-PAYMENT ヘッダの中身を検証 → on-chain transferWithAuthorization を実行。
//
// X-PAYMENT payload (base64 of JSON):
// {
//   x402Version: 1,
//   scheme:  "exact",
//   network: "base-mainnet",
//   payload: {
//     signature: { v, r, s },  // ERC-3009
//     authorization: { from, to, value, validAfter, validBefore, nonce }
//   }
// }

const VerifyBody = z.object({
  paymentHeader: z.string().min(1),   // base64 X-PAYMENT
  accepts:       z.any(),             // Provider が 402 で返した accepts オブジェクト
  serviceId:     z.string().min(1),   // どの provider に発生したリクエストか
});

interface X402Authorization {
  from:        string;
  to:          string;
  value:       string;
  validAfter:  string;
  validBefore: string;
  nonce:       string;
}

interface X402Signature {
  v: number;
  r: string;
  s: string;
}

interface X402PaymentPayload {
  x402Version: number;
  scheme:      string;
  network:     string;
  payload: {
    signature:     X402Signature;
    authorization: X402Authorization;
  };
}

function decodePaymentHeader(b64: string): X402PaymentPayload {
  const raw = Buffer.from(b64, "base64").toString("utf-8");
  return JSON.parse(raw) as X402PaymentPayload;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleVerify(c: any): Promise<any> {
  const body = c.req.valid("json") as z.infer<typeof VerifyBody>;

  let payment: X402PaymentPayload;
  try { payment = decodePaymentHeader(body.paymentHeader); }
  catch { return c.json({ ok: false, reason: "invalid_payment_header" }, 400); }

  // 仕様ガード
  if (payment.x402Version !== 1) {
    return c.json({ ok: false, reason: "unsupported_x402_version" }, 400);
  }
  if (payment.network !== X402_NETWORK) {
    return c.json({ ok: false, reason: `unsupported_network_${payment.network}` }, 400);
  }
  if (payment.scheme !== "exact") {
    return c.json({ ok: false, reason: `unsupported_scheme_${payment.scheme}` }, 400);
  }

  const auth = payment.payload.authorization;
  const sig  = payment.payload.signature;

  // value <= accepts.maxAmountRequired を要求
  const accepted = body.accepts;
  if (accepted && typeof accepted === "object" && "maxAmountRequired" in accepted) {
    const max = BigInt(String((accepted as { maxAmountRequired: string }).maxAmountRequired));
    if (BigInt(auth.value) > max) {
      return c.json({ ok: false, reason: "amount_exceeds_max" }, 400);
    }
  }

  // 受取先が LemonCake の facilitator (spender) と一致するか
  if (auth.to.toLowerCase() !== MARKETPLACE_SPENDER.toLowerCase()) {
    return c.json({ ok: false, reason: "payTo_mismatch" }, 400);
  }

  // window チェック
  const now = Math.floor(Date.now() / 1000);
  if (Number(auth.validAfter)  > now) return c.json({ ok: false, reason: "not_yet_valid" }, 400);
  if (Number(auth.validBefore) < now) return c.json({ ok: false, reason: "expired" }, 400);

  // Provider 存在 / プラン解決
  const provider = await prisma.providerV2.findUnique({
    where: { id: body.serviceId },
    include: { subscription: true },
  });
  if (!provider) return c.json({ ok: false, reason: "provider_not_found" }, 404);

  // on-chain 実行
  try {
    const result = await executeTransferWithAuthorization({
      from:        auth.from        as Address,
      to:          auth.to          as Address,
      value:       BigInt(auth.value),
      validAfter:  BigInt(auth.validAfter),
      validBefore: BigInt(auth.validBefore),
      nonce:       auth.nonce as Hex,
      v:           sig.v,
      r:           sig.r as Hex,
      s:           sig.s as Hex,
    });

    // 課金ログ。冪等性は nonce で取れる（重複時は unique 違反）
    await prisma.permitCharge.create({
      data: {
        ownerAddress:  auth.from,
        serviceId:     body.serviceId,
        amountUsdc:    (Number(auth.value) / 1_000_000).toString(),
        status:        "COMPLETED",
        txHash:        result.txHash,
        idempotencyKey: auth.nonce.slice(0, 36) + "-" + body.serviceId.slice(0, 12),
        completedAt:   new Date(),
      },
    }).catch(() => { /* duplicate replay は黙って成功扱い */ });

    return c.json({ ok: true, txHash: result.txHash, network: X402_NETWORK });
  } catch (e) {
    return c.json({
      ok:     false,
      reason: e instanceof Error ? e.message : "execution_failed",
    }, 502);
  }
}

x402Router.openapi(
  createRoute({
    method:  "post",
    path:    "/verify",
    tags:    ["x402"],
    summary: "x402 payment header を検証して on-chain 実行",
    request: { body: { content: { "application/json": { schema: VerifyBody } }, required: true } },
    responses: {
      200: { content: { "application/json": { schema: z.object({ ok: z.boolean(), txHash: z.string().optional(), network: z.string().optional(), reason: z.string().optional() }) } }, description: "Verified" },
      400: { content: { "application/json": { schema: z.object({ ok: z.boolean(), reason: z.string() }) } }, description: "Verify failed" },
      404: { content: { "application/json": { schema: z.object({ ok: z.boolean(), reason: z.string() }) } }, description: "Provider not found" },
      502: { content: { "application/json": { schema: z.object({ ok: z.boolean(), reason: z.string() }) } }, description: "On-chain failed" },
    },
  }),
  handleVerify,
);

// settle = verify と同義の x402 仕様用エイリアス
x402Router.openapi(
  createRoute({
    method:  "post",
    path:    "/settle",
    tags:    ["x402"],
    summary: "Alias of /verify (x402 spec compat)",
    request: { body: { content: { "application/json": { schema: VerifyBody } }, required: true } },
    responses: {
      200: { content: { "application/json": { schema: z.object({ ok: z.boolean(), txHash: z.string().optional(), network: z.string().optional() }) } }, description: "Settled" },
      400: { content: { "application/json": { schema: z.object({ ok: z.boolean(), reason: z.string() }) } }, description: "Failed" },
      404: { content: { "application/json": { schema: z.object({ ok: z.boolean(), reason: z.string() }) } }, description: "Not found" },
      502: { content: { "application/json": { schema: z.object({ ok: z.boolean(), reason: z.string() }) } }, description: "On-chain failed" },
    },
  }),
  handleVerify,
);

// ─── GET /api/x402/supported ──────────────────────────────────
// x402 Bazaar / クライアントが「この facilitator は何をサポートしてる？」を問う

x402Router.openapi(
  createRoute({
    method:  "get",
    path:    "/supported",
    tags:    ["x402"],
    summary: "サポートする scheme / network 一覧",
    responses: {
      200: { content: { "application/json": { schema: z.object({
        x402Version: z.number(),
        kinds: z.array(z.object({
          scheme:  z.string(),
          network: z.string(),
          asset:   z.string(),
        })),
      }) } }, description: "Supported" },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (c: any) => c.json({
    x402Version: 1,
    kinds: [{
      scheme:  "exact",
      network: X402_NETWORK,
      asset:   BASE_USDC_ADDRESS,
    }],
  }),
);
