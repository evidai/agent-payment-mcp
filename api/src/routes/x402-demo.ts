/**
 * /api/x402-demo — Coinbase Bazaar 自動登録用のセルフ test エンドポイント
 *
 * 目的: CDP facilitator 経由で 1 settle を成功させることで、CDP Bazaar に
 * 自動カタログさせる。Bazaar に乗ると AWS Bedrock AgentCore / 22 社
 * Foundation メンバー経由でも発見されるようになる（global discovery）。
 *
 * 仕様:
 *   GET /api/x402-demo
 *     未払い  → 402 + x402 accepts[]（CDP facilitator が読む形式）
 *     X-PAYMENT 付き → CDP /verify + /settle → 200 + 「hello world」JSON
 *
 * 使い方（trigger Bazaar listing）:
 *   1. Base wallet に 0.001+ USDC + 少額のガス用 ETH を入れる
 *   2. Coinbase の x402 reference client OR 自前の ERC-3009 sign で
 *      このエンドポイントに settle 1 件流す
 *   3. CDP 側で settle 確認 → 自動 Bazaar カタログ
 *
 * このエンドポイント自体は無限にアクセス可能（CDP facilitator が cap 適用）。
 */

import { Hono } from "hono";
import { x402Hono } from "@lemon-cake/x402-server";

export const x402DemoRouter = new Hono();

const DEMO_SERVICE_ID = "cmph0dn6w0000ev7eattayuob";  // ProviderV2: LemonCake x402 demo

// 未払い → 402、X-PAYMENT 付き → CDP facilitator 経由 verify+settle
x402DemoRouter.use("*", x402Hono({
  serviceId:       DEMO_SERVICE_ID,
  pricePerCallUsd: 0.001,
  facilitator:     "coinbase",   // CDP 経由 settle で Bazaar 自動カタログ
  description:     "LemonCake x402 demo — hello-world endpoint for Bazaar registration",
  bazaar: {
    name:        "LemonCake x402 demo",
    description: "Smallest possible paid endpoint (0.001 USDC). Exists to bootstrap LemonCake's presence in the Coinbase x402 Bazaar / AWS Bedrock AgentCore discovery index.",
    category:    "demo",
    tags:        ["lemoncake", "x402", "demo", "non-custodial", "usdc"],
  },
}));

x402DemoRouter.get("/", (c) => c.json({
  hello:        "from LemonCake x402 demo",
  facilitator:  "Coinbase CDP",
  bazaar_ok:    true,
  ts:           new Date().toISOString(),
  next_steps: [
    "If you can read this JSON, you successfully settled 0.001 USDC via CDP.",
    "This endpoint is now (or will shortly be) listed in Coinbase x402 Bazaar.",
    "Visit https://lemoncake.xyz to register your own monetized API.",
  ],
}));
