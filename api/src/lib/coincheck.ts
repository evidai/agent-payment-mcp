/**
 * Coincheck Exchange API クライアント（最小限）
 *
 * v0 で必要なエンドポイント:
 *   GET  /api/accounts/balance     - 残高（JPY / USDC / BTC etc.）
 *   POST /api/exchange/orders      - 成行売り（USDC → JPY）
 *   POST /api/send_money           - 暗号資産送金（今は使わない）
 *   POST /api/withdraws            - JPY 銀行口座出金
 *
 * 認証: HMAC-SHA256
 *   ACCESS-KEY:       API key
 *   ACCESS-NONCE:     incrementing nonce (ms timestamp で十分)
 *   ACCESS-SIGNATURE: HMAC_SHA256(secret, nonce + url + body)
 *
 * Doc: https://coincheck.com/documents/exchange/api
 */

import { createHmac } from "node:crypto";

const BASE = "https://coincheck.com";

export interface CoincheckCredentials {
  apiKey:    string;
  apiSecret: string;
}

interface CoincheckSignedRequest {
  method: "GET" | "POST" | "DELETE";
  path:   string;
  body?:  Record<string, unknown>;
}

function sign(creds: CoincheckCredentials, req: CoincheckSignedRequest): Record<string, string> {
  const nonce  = String(Date.now());
  const url    = BASE + req.path;
  const body   = req.body ? JSON.stringify(req.body) : "";
  const sig    = createHmac("sha256", creds.apiSecret).update(nonce + url + body).digest("hex");
  return {
    "ACCESS-KEY":       creds.apiKey,
    "ACCESS-NONCE":     nonce,
    "ACCESS-SIGNATURE": sig,
  };
}

async function call<T>(
  creds: CoincheckCredentials,
  req:   CoincheckSignedRequest,
): Promise<T> {
  const headers = {
    ...sign(creds, req),
    "Content-Type": "application/json",
  };
  const res = await fetch(BASE + req.path, {
    method: req.method,
    headers,
    body: req.body ? JSON.stringify(req.body) : undefined,
  });
  const text = await res.text();
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch { parsed = { raw: text }; }

  if (!res.ok || (parsed && typeof parsed === "object" && (parsed as { success?: boolean }).success === false)) {
    const msg = (parsed && typeof parsed === "object" && "error" in parsed)
      ? String((parsed as { error?: string }).error)
      : `Coincheck ${res.status}`;
    throw new Error(`Coincheck API failed: ${msg}`);
  }
  return parsed as T;
}

// ─── 残高 ───────────────────────────────────────────────────

export interface CoincheckBalance {
  success: boolean;
  jpy:     string;
  btc:     string;
  usdt?:   string;
  usdc?:   string;
}

export async function getBalance(creds: CoincheckCredentials): Promise<CoincheckBalance> {
  return call<CoincheckBalance>(creds, { method: "GET", path: "/api/accounts/balance" });
}

// ─── 成行売り（USDC → JPY） ─────────────────────────────────
// pair: "usdc_jpy"。amount は USDC 量。

export interface CoincheckMarketSellResponse {
  success:     boolean;
  id:          number;
  amount:      string;
  rate?:       string;
  pair:        string;
  order_type:  string;
  created_at:  string;
}

export async function marketSellUsdc(
  creds:      CoincheckCredentials,
  amountUsdc: string,
): Promise<CoincheckMarketSellResponse> {
  return call<CoincheckMarketSellResponse>(creds, {
    method: "POST",
    path:   "/api/exchange/orders",
    body: {
      pair:       "usdc_jpy",
      order_type: "market_sell",
      amount:     amountUsdc,
    },
  });
}

// ─── JPY 銀行口座出金 ───────────────────────────────────────
// bankAccountId は Coincheck ダッシュボードで事前登録した銀行口座 ID。

export interface CoincheckWithdrawResponse {
  success:        boolean;
  id:             number;
  status:         string;
  amount:         string;
  currency:       string;
  bank_account_id:number;
  created_at:     string;
}

export async function withdrawJpy(
  creds:         CoincheckCredentials,
  amountJpy:     number,
  bankAccountId: number,
): Promise<CoincheckWithdrawResponse> {
  return call<CoincheckWithdrawResponse>(creds, {
    method: "POST",
    path:   "/api/withdraws",
    body: {
      bank_account_id: bankAccountId,
      amount:          amountJpy,
      currency:        "JPY",
    },
  });
}

// ─── 入金アドレス取得（USDC を取引所に送る先） ──────────────
// /api/deposit_money は法定通貨用なので、暗号資産は /api/accounts などから
// ウォレット情報を取得する。v0 では Provider が手動で取引所の入金アドレスを
// connection 作成時に登録する想定にし、API 動的取得は v1 で実装する。
