/**
 * /api/onramp/* — fiat-to-crypto onramp の signed URL 発行
 *
 * 現在対応:
 *   - Alchemy Pay  (JP × USDC × Base × Apple/Google Pay 対応)
 *     ※ Privy Funds (MoonPay Rails) が JP "Coming soon" のため、JP buyer の
 *       Stripe レベル UX を実現する唯一の現実解
 *
 * Alchemy Pay は appId + appSecret を発行制で、URL に HMAC-SHA256 signature が
 * 必要。secret を client に晒さないため、server-side で URL を組み立てて返す。
 *
 * Required env:
 *   - ALCHEMY_PAY_APP_ID
 *   - ALCHEMY_PAY_SECRET
 *   - ALCHEMY_PAY_ENV    (= "test" or "production", default "production")
 *
 * unset の場合、404 を返してフロントエンドが fallback 動線（手動ガイド）に
 * 流すよう促す。
 */

import crypto from "node:crypto";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

export const onrampRouter = new OpenAPIHono();

const APP_ID = process.env.ALCHEMY_PAY_APP_ID ?? "";
const SECRET = process.env.ALCHEMY_PAY_SECRET ?? "";
const ENV    = process.env.ALCHEMY_PAY_ENV    ?? "production";
const RAMP_BASE_URL = ENV === "test"
  ? "https://ramptest.alchemypay.org"
  : "https://ramp.alchemypay.org";

const ErrorSchema = z.object({ error: z.string() });

// ─── POST /api/onramp/alchemy-pay/url ─────────────────────────
//
// 入力:  { walletAddress, fiat?, fiatAmount?, crypto?, network? }
// 出力:  { url: "https://ramp.alchemypay.org/index/rampPageBuy?..." }
//
// signature 仕様 (Alchemy Pay docs より):
//   1. params を alphabetic sort、空 value を除外
//   2. query string 化（key=value& 連結）
//   3. signatureString = `${timestamp}GET/index/rampPageBuy?${queryString}`
//   4. HMAC-SHA256 with SECRET → base64
//   5. URL に sign=${encodeURIComponent(signature)} を追加
const BuildBody = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  fiat:          z.string().max(10).default("JPY"),
  fiatAmount:    z.string().regex(/^\d+(\.\d{1,2})?$/).default("3000"),
  crypto:        z.string().max(10).default("USDC"),
  network:       z.string().max(20).default("BASE"),
});

const alchemyPayUrlRoute = createRoute({
  method:  "post",
  path:    "/alchemy-pay/url",
  tags:    ["Onramp"],
  summary: "Alchemy Pay onramp 用 signed URL を発行",
  description:
    "JP buyer 向け Apple/Google Pay → USDC on Base 経路。" +
    "ALCHEMY_PAY_APP_ID / ALCHEMY_PAY_SECRET が env 未設定なら 404。",
  request: {
    body: {
      content: { "application/json": { schema: BuildBody } },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            url:       z.string().url(),
            env:       z.string(),
            crypto:    z.string(),
            network:   z.string(),
            fiat:      z.string(),
            fiatAmount:z.string(),
          }),
        },
      },
      description: "Signed URL",
    },
    404: { content: { "application/json": { schema: ErrorSchema } }, description: "Alchemy Pay not configured" },
  },
});

onrampRouter.openapi(alchemyPayUrlRoute, async (c) => {
  if (!APP_ID || !SECRET) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return c.json({ error: "Alchemy Pay credentials not configured. Set ALCHEMY_PAY_APP_ID and ALCHEMY_PAY_SECRET env vars." }, 404) as any;
  }

  const body = c.req.valid("json");
  const timestamp = Date.now().toString();

  // 1. params 組み立て (空 value 除外、alphabetic sort 用に object)
  const params: Record<string, string> = {
    appId:          APP_ID,
    crypto:         body.crypto,
    fiat:           body.fiat,
    fiatAmount:     body.fiatAmount,
    network:        body.network,
    timestamp,
    walletAddress:  body.walletAddress,
  };

  // 2. sorted query string (Alchemy 仕様: alphabetic, 空除外)
  const queryString = Object.keys(params)
    .sort()
    .filter(k => params[k] !== "")
    .map(k => `${k}=${params[k]}`)
    .join("&");

  // 3. signature string: timestamp + HTTP method (uppercase) + path + ?query
  const httpMethod  = "GET";
  const requestPath = "/index/rampPageBuy";
  const signatureString = `${timestamp}${httpMethod}${requestPath}?${queryString}`;

  // 4. HMAC-SHA256 with SECRET → base64
  const hmac = crypto.createHmac("sha256", SECRET);
  hmac.update(signatureString);
  const signature = hmac.digest("base64");

  // 5. final URL with URL-encoded signature
  const finalUrl = `${RAMP_BASE_URL}${requestPath}?${queryString}&sign=${encodeURIComponent(signature)}`;

  return c.json({
    url:        finalUrl,
    env:        ENV,
    crypto:     body.crypto,
    network:    body.network,
    fiat:       body.fiat,
    fiatAmount: body.fiatAmount,
  });
});
