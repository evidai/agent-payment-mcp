/**
 * /api/admin/bootstrap — Coinbase Bazaar self-bootstrap controls
 *
 * 目的: 起きた user が spender wallet に $1 USDC + ガス用 ETH を入れたら、
 * 管理ダッシュボードのボタン 1 つで /api/x402-demo を 1 回叩き、CDP facilitator
 * 経由で settle させる。CDP は initial successful settle 時に resource URL を
 * Bazaar discovery index にカタログするので、これで LemonCake が AWS Bedrock
 * AgentCore / 22 社 Foundation 経由の global discovery に乗る。
 *
 * 仕組み:
 *   - GET  /api/admin/bootstrap/status — spender 残高 (USDC + ETH) + 前回結果
 *   - POST /api/admin/bootstrap/bazaar — 実行
 *       1. spender 秘密鍵で ERC-3009 transferWithAuthorization を EIP-712 署名
 *          （from = spender, to = spender, value = 1000 micro-USDC = $0.001）
 *       2. base64 X-PAYMENT header を組み立て
 *       3. 自前 /api/x402-demo に GET で self-loopback
 *          → middleware (@lemon-cake/x402-server, facilitator="coinbase") が
 *            CDP /verify + /settle に転送 → settle 成功で Bazaar 自動カタログ
 *       4. tx hash + 結果を返却
 *
 * 自払いなのでネット USDC 移動はゼロ (gas のみ)。CDP は from/to の一致を
 * reject しない（ERC-3009 仕様にも一致禁止条項なし）。
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
  createPublicClient,
  http,
  parseSignature,
  type Address,
  type Hex,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { verifyAdminToken } from "../lib/jwt.js";
import { BASE_USDC_ADDRESS, getBaseUsdcBalance } from "../lib/usdc-base-permit.js";

export const adminBootstrapRouter = new OpenAPIHono();

// LemonCake marketplace spender = /api/x402 内の MARKETPLACE_SPENDER と一致
const SPENDER_ADDRESS = "0x23e0D435b62d8eABE2b239c461Ec6fb2E8B7E965" as Address;
const DEMO_RESOURCE_PATH = "/api/x402-demo";

// in-memory (per-process) cache for last bootstrap result. redeploy で消えても OK —
// 成功すれば Bazaar に永続的にカタログ済みなので状態は不要。
let lastResult: {
  ranAt:       string;
  status:      "success" | "failed";
  txHash?:     string;
  facilitator?:string;
  httpStatus?: number;
  reason?:     string;
} | null = null;

// ─── helpers ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function requireAdmin(c: any): Promise<string | null> {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return "Missing Bearer token";
  if (!(await verifyAdminToken(auth.slice(7)))) return "Invalid token";
  return null;
}

function getSpenderAccount() {
  const raw = process.env.BASE_SPENDER_PRIVATE_KEY;
  if (!raw) throw new Error("BASE_SPENDER_PRIVATE_KEY not set");
  const key = (raw.startsWith("0x") ? raw : "0x" + raw) as Hex;
  return privateKeyToAccount(key);
}

function getRpcUrl(): string {
  return process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getApiBaseUrl(c: any): string {
  // 明示 env vars 優先（Railway / Vercel どちらでも override 可能）
  const explicit =
    process.env.API_PUBLIC_URL ??
    process.env.PUBLIC_API_URL ??
    process.env.PUBLIC_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  // fallback: request header から組み立て
  const proto = c.req.header("x-forwarded-proto") ?? "https";
  const host  = c.req.header("host") ?? "localhost";
  return `${proto}://${host}`;
}

function randomNonceHex32(): Hex {
  const arr = new Uint8Array(32);
  const c =
    (globalThis as { crypto?: { getRandomValues: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) {
    c.getRandomValues(arr);
  } else {
    // Node fallback (should be unused on Node 18+)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { webcrypto } = require("node:crypto") as { webcrypto: Crypto };
    webcrypto.getRandomValues(arr);
  }
  return ("0x" + Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("")) as Hex;
}

// ─── GET /status ──────────────────────────────────────────────────
// spender wallet 残高 + 前回結果。UI はこれを表示し ready=true でボタン活性化。

adminBootstrapRouter.openapi(
  createRoute({
    method:  "get",
    path:    "/status",
    tags:    ["AdminBootstrap"],
    summary: "spender wallet 残高と前回 bootstrap 結果",
    security: [{ Bearer: [] }],
    responses: {
      200: { content: { "application/json": { schema: z.object({
        spenderAddress: z.string(),
        usdcBalance:    z.string(),
        usdcBalanceRaw: z.string(),
        ethBalance:     z.string(),
        ethBalanceWei:  z.string(),
        ready:          z.boolean(),
        needs:          z.array(z.string()),
        resourceUrl:    z.string(),
        lastResult:     z.any().nullable(),
      }) } }, description: "Status" },
      401: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Unauthorized" },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const err = await requireAdmin(c);
    if (err) return c.json({ error: err }, 401);

    // spender 実体（PK 設定漏れ検出 + UI 表示用）
    let spender: Address = SPENDER_ADDRESS;
    let spenderMismatch = false;
    try {
      const acct = getSpenderAccount();
      if (acct.address.toLowerCase() !== SPENDER_ADDRESS.toLowerCase()) {
        spender = acct.address as Address;
        spenderMismatch = true;
      }
    } catch {
      // PK 未設定 — needs に出す
    }

    let usdcRaw = 0n;
    let ethWei  = 0n;
    let rpcError: string | null = null;
    try {
      usdcRaw = await getBaseUsdcBalance(spender);
      const publicClient = createPublicClient({ chain: base, transport: http(getRpcUrl()) });
      ethWei = await publicClient.getBalance({ address: spender });
    } catch (e) {
      rpcError = e instanceof Error ? e.message : String(e);
    }

    const needs: string[] = [];
    if (!process.env.BASE_SPENDER_PRIVATE_KEY) {
      needs.push("BASE_SPENDER_PRIVATE_KEY が未設定");
    }
    if (spenderMismatch) {
      needs.push(`設定済み PK のアドレスが想定 spender と一致しない (got ${spender})`);
    }
    if (usdcRaw < 10_000n) {
      // 0.01 USDC 最低 (実 cost は 0.001 USDC + gas)
      needs.push(`spender に 0.01 USDC 以上が必要 (現在 ${(Number(usdcRaw)/1e6).toFixed(6)})`);
    }
    if (ethWei < 200_000_000_000_000n) {
      // 0.0002 ETH ≒ 数十円。Base は gas が非常に安いので十分。
      needs.push(`spender に 0.0002 ETH 以上が必要 (現在 ${(Number(ethWei)/1e18).toFixed(6)})`);
    }
    if (rpcError) needs.push(`Base RPC 取得失敗: ${rpcError}`);

    return c.json({
      spenderAddress: spender,
      usdcBalance:    (Number(usdcRaw) / 1_000_000).toFixed(6),
      usdcBalanceRaw: usdcRaw.toString(),
      ethBalance:     (Number(ethWei) / 1e18).toFixed(6),
      ethBalanceWei:  ethWei.toString(),
      ready:          needs.length === 0,
      needs,
      resourceUrl:    getApiBaseUrl(c) + DEMO_RESOURCE_PATH,
      lastResult,
    });
  },
);

// ─── POST /bazaar ─────────────────────────────────────────────────
// spender が自分自身に 0.001 USDC を ERC-3009 で送る → middleware 経由 CDP
// settle → Bazaar 自動カタログ。

adminBootstrapRouter.openapi(
  createRoute({
    method:  "post",
    path:    "/bazaar",
    tags:    ["AdminBootstrap"],
    summary: "Bazaar 自動カタログを誘発（spender が自払い）",
    security: [{ Bearer: [] }],
    responses: {
      200: { content: { "application/json": { schema: z.object({
        ok:          z.boolean(),
        httpStatus:  z.number(),
        txHash:      z.string().optional(),
        facilitator: z.string().optional(),
        body:        z.any(),
        reason:      z.string().optional(),
        resourceUrl: z.string(),
      }) } }, description: "Bootstrap result" },
      401: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Unauthorized" },
      500: { content: { "application/json": { schema: z.object({ ok: z.boolean(), reason: z.string() }) } }, description: "Server error" },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const err = await requireAdmin(c);
    if (err) return c.json({ error: err }, 401);

    let account;
    try {
      account = getSpenderAccount();
    } catch (e) {
      return c.json({ ok: false, reason: e instanceof Error ? e.message : "spender_pk_missing" }, 500);
    }

    // ── 1. EIP-712 sign ERC-3009 (self → self, $0.001) ──────────
    const now         = BigInt(Math.floor(Date.now() / 1000));
    const validAfter  = now - 60n;
    const validBefore = now + 3600n;
    const value       = 1000n;   // 1000 micro-USDC = $0.001
    const nonce       = randomNonceHex32();
    const fromTo      = account.address as Address;

    let sigHex: Hex;
    try {
      sigHex = await account.signTypedData({
        domain: {
          name:    "USD Coin",
          version: "2",
          chainId: 8453,
          verifyingContract: BASE_USDC_ADDRESS,
        },
        types: {
          TransferWithAuthorization: [
            { name: "from",        type: "address" },
            { name: "to",          type: "address" },
            { name: "value",       type: "uint256" },
            { name: "validAfter",  type: "uint256" },
            { name: "validBefore", type: "uint256" },
            { name: "nonce",       type: "bytes32" },
          ],
        },
        primaryType: "TransferWithAuthorization",
        message: {
          from:        fromTo,
          to:          fromTo,
          value,
          validAfter,
          validBefore,
          nonce,
        },
      });
    } catch (e) {
      return c.json({ ok: false, reason: `sign_failed: ${e instanceof Error ? e.message : "unknown"}` }, 500);
    }

    const parsed = parseSignature(sigHex);
    const vNum = parsed.v !== undefined ? Number(parsed.v) : (27 + parsed.yParity);

    const paymentObj = {
      x402Version: 1,
      scheme:  "exact",
      network: "base",
      payload: {
        signature:     { v: vNum, r: parsed.r, s: parsed.s },
        authorization: {
          from:        fromTo,
          to:          fromTo,
          value:       value.toString(),
          validAfter:  validAfter.toString(),
          validBefore: validBefore.toString(),
          nonce,
        },
      },
    };
    const paymentHeader = Buffer.from(JSON.stringify(paymentObj)).toString("base64");

    // ── 2. self-loopback GET /api/x402-demo with X-PAYMENT ──────
    // middleware (facilitator: "coinbase") が CDP /verify + /settle に転送し、
    // 成功時に CDP が resource URL を Bazaar に自動カタログする。
    const resourceUrl = getApiBaseUrl(c) + DEMO_RESOURCE_PATH;

    let httpStatus = 0;
    let body: unknown = null;
    let txHash:      string | undefined;
    let facilitator: string | undefined;
    let reason:      string | undefined;

    try {
      const resp = await fetch(resourceUrl, {
        method:  "GET",
        headers: { "X-PAYMENT": paymentHeader },
      });
      httpStatus  = resp.status;
      txHash      = resp.headers.get("X-Payment-Tx-Hash")     ?? undefined;
      facilitator = resp.headers.get("X-Payment-Facilitator") ?? undefined;
      try { body = await resp.json(); }
      catch { body = await resp.text().catch(() => null); }
      if (httpStatus >= 400) {
        const errMsg = (body as { error?: string } | null)?.error;
        reason = errMsg ?? `HTTP ${httpStatus}`;
      }
    } catch (e) {
      reason = e instanceof Error ? e.message : String(e);
    }

    const ok = httpStatus >= 200 && httpStatus < 300;
    lastResult = {
      ranAt:       new Date().toISOString(),
      status:      ok ? "success" : "failed",
      txHash,
      facilitator,
      httpStatus,
      reason,
    };

    return c.json({ ok, httpStatus, txHash, facilitator, body, reason, resourceUrl });
  },
);
