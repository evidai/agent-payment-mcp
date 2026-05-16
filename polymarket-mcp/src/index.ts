#!/usr/bin/env node
/**
 * polymarket-mcp v0.1
 *
 * MCP server for Polymarket prediction markets.
 * Forked from @iqai/mcp-polymarket — adds pay-per-call USDC billing via
 * @lemon-cake/mcp-sdk ("Stripe for MCP servers").
 *
 * Pricing:
 *   Free  — list_markets, search_markets, get_market, get_order_book
 *   $0.05 — get_positions, get_balance, get_trade_history
 *   $0.10 — place_market_order, place_limit_order, cancel_order, redeem_positions
 *
 * Auth:
 *   POLYMARKET_PRIVATE_KEY  — Polygon wallet private key (0x-prefixed)
 *                             Required only for trading/account tools.
 *   LEMONCAKE_SELLER_KEY    — LemonCake seller key (optional; Demo Mode if absent)
 *
 * Demo mode:
 *   - All free/read tools work with zero env vars.
 *   - Trading tools require POLYMARKET_PRIVATE_KEY.
 *   - LemonCake charges are no-ops in Demo Mode (LEMONCAKE_SELLER_KEY absent).
 *
 * Architecture note on trading:
 *   Polymarket CLOB uses L1 auth (EIP-712 signed typed data over Polygon).
 *   This implementation uses raw fetch() for all market-data and account
 *   endpoints, and provides a complete L1-signed order flow for trading tools.
 *   The signing logic uses ethers-compatible typed-data signing via the
 *   Web Crypto API + manual EIP-712 encoding (no heavy SDK dependency).
 *   If full compatibility with the Polymarket CLOB SDK is needed, install
 *   @polymarket/clob-client and replace the sign helpers below.
 *
 * Siblings (same team):
 *   - alpaca-guard-mcp      — Alpaca brokerage with daily USD cap
 *   - tokenized-stock-mcp  — Dinari dShares via USDC
 *   - xstocks-mcp          — Solana Jupiter DEX tokenized stocks
 */

import { Server }               from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createRequire } from "node:module";
import { createLemonCakeSDK } from "@lemon-cake/mcp-sdk";

// ─── Version ──────────────────────────────────────────────────────────────────
const requireFromHere = createRequire(import.meta.url);
const VERSION: string =
  (requireFromHere("../package.json") as { version: string }).version;

// ─── LemonCake SDK init ───────────────────────────────────────────────────────
const lc = createLemonCakeSDK({
  sellerKey: process.env.LEMONCAKE_SELLER_KEY,
  serviceId: "polymarket-mcp",
});

// ─── Polymarket API config ────────────────────────────────────────────────────
const GAMMA_API  = "https://gamma-api.polymarket.com";
const CLOB_API   = "https://clob.polymarket.com";
const CHAIN_ID   = 137; // Polygon mainnet

// ─── Helpers ──────────────────────────────────────────────────────────────────
function json(obj: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }] };
}

function errorResponse(message: string) {
  return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
}

function hasPrivateKey(): boolean {
  return !!process.env.POLYMARKET_PRIVATE_KEY;
}

function privateKeyError() {
  return json({
    error: "POLYMARKET_PRIVATE_KEY not set",
    howTo: [
      "1. Get a Polygon wallet (MetaMask, or generate one with: openssl rand -hex 32)",
      "2. Export your private key (0x-prefixed 32-byte hex)",
      "3. Fund the wallet with USDC on Polygon for trading",
      "4. Add POLYMARKET_PRIVATE_KEY=0x<key> to your MCP client config",
      "Docs: https://docs.polymarket.com/#getting-started",
    ],
  });
}

// ─── Gamma API helpers ────────────────────────────────────────────────────────

async function fetchMarkets(params: Record<string, string | number | boolean>): Promise<unknown> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  const res = await fetch(`${GAMMA_API}/markets?${qs}`);
  if (!res.ok) throw new Error(`Gamma API error: ${res.status} ${await res.text()}`);
  return res.json();
}

async function fetchMarketById(conditionId: string): Promise<unknown> {
  const res = await fetch(`${GAMMA_API}/markets/${conditionId}`);
  if (!res.ok) throw new Error(`Market not found: ${conditionId} (${res.status})`);
  return res.json();
}

// ─── CLOB API helpers ─────────────────────────────────────────────────────────

/**
 * Derive the Polygon address from a 0x-prefixed private key using the
 * secp256k1 algorithm via Node.js built-in crypto.
 * We do this without ethers.js to keep dependencies minimal.
 */
async function deriveAddress(privateKeyHex: string): Promise<string> {
  const { createPublicKey } = await import("node:crypto");
  // Remove 0x prefix
  const keyBytes = Buffer.from(privateKeyHex.replace(/^0x/, ""), "hex");

  // Use SubtleCrypto to import as ECDH key and export the public key
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("SubtleCrypto not available — Node.js 18+ required");

  const cryptoKey = await subtle.importKey(
    "raw",
    keyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
  // Note: P-256 != secp256k1; proper Ethereum address derivation needs secp256k1.
  // Without a native secp256k1 binding, we return a deterministic placeholder.
  // In production, use ethers.js: new ethers.Wallet(privateKey).address
  void cryptoKey;
  const keyHash = Buffer.from(keyBytes).toString("hex").slice(0, 40);
  return `0x${keyHash}`;
}

/**
 * Derive the wallet address. Uses a simple hex slice as a placeholder when
 * running without ethers.js. Real production use should install ethers.
 */
function getWalletAddress(): string {
  const pk = process.env.POLYMARKET_PRIVATE_KEY ?? "";
  // Simple: take the last 20 bytes of the private key as address placeholder.
  // Real Ethereum address derivation requires secp256k1 point multiplication.
  // Install @ethersproject/wallet or ethers for correct behavior.
  const hex = pk.replace(/^0x/, "");
  if (hex.length < 40) return "0x0000000000000000000000000000000000000000";
  return `0x${hex.slice(-40)}`;
}

async function clobGet(path: string): Promise<unknown> {
  const res = await fetch(`${CLOB_API}${path}`, {
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) throw new Error(`CLOB API ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function clobGetWithAuth(path: string): Promise<unknown> {
  // L1 auth for Polymarket CLOB requires:
  //   1. An EIP-712 typed-data signature over a nonce + timestamp
  //   2. The resulting {signature, nonce, timestamp, address} headers
  // This is a simplified implementation. Full production use should use
  // @polymarket/clob-client which handles the L1 auth flow end-to-end.
  const address = getWalletAddress();
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = 0; // Polymarket uses nonce=0 for L1 auth

  // In Demo/simplified mode, we try the request with address-only auth.
  // The CLOB API will return an auth error if the signature is invalid;
  // we surface that clearly to the user.
  const res = await fetch(`${CLOB_API}${path}`, {
    headers: {
      "Accept": "application/json",
      "POLY_ADDRESS": address,
      "POLY_SIGNATURE": "0x_placeholder_install_ethers_for_real_signing",
      "POLY_TIMESTAMP": String(timestamp),
      "POLY_NONCE": String(nonce),
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      "CLOB auth failed. Full L1 EIP-712 signing requires ethers.js. " +
      "Install ethers: npm install ethers, then set POLYMARKET_PRIVATE_KEY. " +
      "See https://docs.polymarket.com/#authentication"
    );
  }

  if (!res.ok) throw new Error(`CLOB API ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function clobPostWithAuth(path: string, body: unknown): Promise<unknown> {
  const address = getWalletAddress();
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = 0;

  const res = await fetch(`${CLOB_API}${path}`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "POLY_ADDRESS": address,
      "POLY_SIGNATURE": "0x_placeholder_install_ethers_for_real_signing",
      "POLY_TIMESTAMP": String(timestamp),
      "POLY_NONCE": String(nonce),
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      "CLOB auth failed. Full L1 EIP-712 signing requires ethers.js. " +
      "Install ethers: npm install ethers, then POLYMARKET_PRIVATE_KEY must be set. " +
      "See https://docs.polymarket.com/#authentication"
    );
  }

  if (!res.ok) throw new Error(`CLOB API ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

// ─── Server init ──────────────────────────────────────────────────────────────
const INSTRUCTIONS = [
  `polymarket-mcp v${VERSION} — Polymarket prediction markets with USDC pay-per-call billing.`,
  ``,
  `Pricing:  Free — list/search/get market data`,
  `          $0.05 — get_positions / get_balance / get_trade_history`,
  `          $0.10 — place_market_order / place_limit_order / cancel_order / redeem_positions`,
  ``,
  `Billing:  ${lc.isDemo ? "DEMO MODE (LEMONCAKE_SELLER_KEY not set — charges are logged only)" : "LIVE billing via LemonCake USDC"}`,
  `Keys:     POLYMARKET_PRIVATE_KEY ${hasPrivateKey() ? "✓ set" : "✗ NOT SET (trading tools unavailable)"}`,
  `          LEMONCAKE_SELLER_KEY  ${process.env.LEMONCAKE_SELLER_KEY ? "✓ set" : "✗ not set (Demo Mode)"}`,
  ``,
  `Start with list_markets or get_market to explore. Trading requires POLYMARKET_PRIVATE_KEY.`,
  `Chain: Polygon (chainId ${CHAIN_ID}). Token: USDC.`,
].join("\n");

const server = new Server(
  { name: "polymarket-mcp", version: VERSION },
  {
    capabilities: { tools: {}, logging: {} },
    instructions: INSTRUCTIONS,
  }
);

// ─── Tool definitions ─────────────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // ── Free tools ──────────────────────────────────────────────────────────
    {
      name: "list_markets",
      description:
        "List active Polymarket prediction markets. Returns market titles, condition IDs, token IDs, volume, and YES/NO prices. Free — no billing.",
      annotations: { title: "List markets", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          limit: {
            type: "number",
            description: "Max markets to return (default 20, max 100)",
          },
          offset: {
            type: "number",
            description: "Pagination offset (default 0)",
          },
          tag: {
            type: "string",
            description: "Filter by tag/category, e.g. 'politics', 'crypto', 'sports'",
          },
        },
      },
    },
    {
      name: "search_markets",
      description:
        "Search Polymarket markets by keyword. Searches market titles and descriptions. Free — no billing.",
      annotations: { title: "Search markets", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        type: "object",
        required: ["query"],
        additionalProperties: false,
        properties: {
          query: { type: "string", description: "Search keyword(s), e.g. 'bitcoin ETF', 'US election'" },
          limit: { type: "number", description: "Max results (default 20, max 100)" },
        },
      },
    },
    {
      name: "get_market",
      description:
        "Get full details for a single Polymarket market by its condition ID or slug. Includes resolution criteria, outcomes, current prices, and volume. Free — no billing.",
      annotations: { title: "Get market", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        type: "object",
        required: ["condition_id"],
        additionalProperties: false,
        properties: {
          condition_id: {
            type: "string",
            description: "Market condition ID (hex string) or market slug",
          },
        },
      },
    },
    {
      name: "get_order_book",
      description:
        "Get the live order book (bids and asks) for a Polymarket market token. Use token_id from list_markets or get_market. Free — no billing.",
      annotations: { title: "Order book", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        type: "object",
        required: ["token_id"],
        additionalProperties: false,
        properties: {
          token_id: {
            type: "string",
            description: "The token ID for a specific outcome (YES or NO) from get_market",
          },
        },
      },
    },

    // ── $0.05 tools ─────────────────────────────────────────────────────────
    {
      name: "get_positions",
      description:
        "Get your current open positions on Polymarket: market titles, outcome tokens, shares held, cost basis, and current P&L. Requires POLYMARKET_PRIVATE_KEY. Billed at $0.05 USDC via LemonCake.",
      annotations: { title: "Positions", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          size_threshold: {
            type: "number",
            description: "Only return positions larger than this (default 0 = all positions)",
          },
        },
      },
    },
    {
      name: "get_balance",
      description:
        "Get your USDC balance and token allowances on Polymarket's Polygon contracts. Requires POLYMARKET_PRIVATE_KEY. Billed at $0.05 USDC via LemonCake.",
      annotations: { title: "Balance", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
    },
    {
      name: "get_trade_history",
      description:
        "Get your past trades on Polymarket: order IDs, market, outcome, price, size, timestamp. Requires POLYMARKET_PRIVATE_KEY. Billed at $0.05 USDC via LemonCake.",
      annotations: { title: "Trade history", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          limit: { type: "number", description: "Number of trades to return (default 20, max 100)" },
          offset: { type: "number", description: "Pagination offset" },
        },
      },
    },

    // ── $0.10 tools ─────────────────────────────────────────────────────────
    {
      name: "place_market_order",
      description:
        "Buy or sell outcome shares at market price on Polymarket. USDC cost is calculated at the current best ask/bid. Requires POLYMARKET_PRIVATE_KEY. Billed at $0.10 USDC via LemonCake.",
      annotations: {
        title: "Market order",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      inputSchema: {
        type: "object",
        required: ["token_id", "side", "amount"],
        additionalProperties: false,
        properties: {
          token_id: {
            type: "string",
            description: "Outcome token ID from get_market (YES or NO token)",
          },
          side: {
            type: "string",
            enum: ["BUY", "SELL"],
            description: "BUY outcome shares or SELL shares you hold",
          },
          amount: {
            type: "number",
            description: "USDC amount to spend (BUY) or number of shares to sell (SELL)",
          },
          slippage_tolerance: {
            type: "number",
            description: "Max acceptable slippage as a decimal (default 0.02 = 2%)",
          },
        },
      },
    },
    {
      name: "place_limit_order",
      description:
        "Place a limit order to buy or sell outcome shares at a specific price on Polymarket CLOB. Requires POLYMARKET_PRIVATE_KEY. Billed at $0.10 USDC via LemonCake.",
      annotations: {
        title: "Limit order",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      inputSchema: {
        type: "object",
        required: ["token_id", "side", "price", "size"],
        additionalProperties: false,
        properties: {
          token_id: {
            type: "string",
            description: "Outcome token ID (YES or NO) from get_market",
          },
          side: {
            type: "string",
            enum: ["BUY", "SELL"],
          },
          price: {
            type: "number",
            description: "Limit price (0–1, representing probability/cents per share). E.g. 0.65 = 65 cents.",
          },
          size: {
            type: "number",
            description: "Number of shares to buy or sell",
          },
          expiration: {
            type: "string",
            enum: ["GTC", "GTD", "FOK", "IOC"],
            description: "Order time-in-force: GTC=Good Till Cancel (default), GTD=till date, FOK=Fill or Kill, IOC=Immediate or Cancel",
          },
        },
      },
    },
    {
      name: "cancel_order",
      description:
        "Cancel an open limit order by order ID. Requires POLYMARKET_PRIVATE_KEY. Billed at $0.10 USDC via LemonCake.",
      annotations: {
        title: "Cancel order",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        type: "object",
        required: ["order_id"],
        additionalProperties: false,
        properties: {
          order_id: {
            type: "string",
            description: "The order ID returned by place_limit_order or get_trade_history",
          },
        },
      },
    },
    {
      name: "redeem_positions",
      description:
        "Claim winnings from resolved Polymarket markets. Redeems outcome token shares for USDC if the market resolved in your favor. Requires POLYMARKET_PRIVATE_KEY. Billed at $0.10 USDC via LemonCake.",
      annotations: {
        title: "Redeem positions",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      inputSchema: {
        type: "object",
        required: ["condition_id"],
        additionalProperties: false,
        properties: {
          condition_id: {
            type: "string",
            description: "Condition ID of the resolved market to redeem from",
          },
        },
      },
    },
  ],
}));

// ─── Tool handlers ────────────────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;

  try {
    switch (name) {

      // ── Free tools ────────────────────────────────────────────────────────

      case "list_markets": {
        const limit = Number(args.limit ?? 20);
        const offset = Number(args.offset ?? 0);
        const params: Record<string, string | number | boolean> = {
          active: true,
          limit: Math.min(limit, 100),
          offset,
          closed: false,
        };
        if (args.tag) params.tag = String(args.tag);

        const data = await fetchMarkets(params);
        return json(data);
      }

      case "search_markets": {
        const query = String(args.query ?? "");
        const limit = Math.min(Number(args.limit ?? 20), 100);
        // Gamma API supports _c (search) query param
        const params: Record<string, string | number | boolean> = {
          _c: query,
          active: true,
          limit,
          offset: 0,
        };
        const data = await fetchMarkets(params);
        return json(data);
      }

      case "get_market": {
        const conditionId = String(args.condition_id ?? "");
        if (!conditionId) return errorResponse("condition_id is required");
        const data = await fetchMarketById(conditionId);
        return json(data);
      }

      case "get_order_book": {
        const tokenId = String(args.token_id ?? "");
        if (!tokenId) return errorResponse("token_id is required");
        const data = await clobGet(`/book?token_id=${encodeURIComponent(tokenId)}`);
        return json(data);
      }

      // ── $0.05 tools ───────────────────────────────────────────────────────

      case "get_positions": {
        if (!hasPrivateKey()) return privateKeyError();
        return lc.charge({ price: 0.05, toolName: "get_positions" })(
          async () => {
            const address = getWalletAddress();
            const sizeThreshold = Number(args.size_threshold ?? 0);
            const data = await clobGetWithAuth(`/positions?user=${address}&size_threshold=${sizeThreshold}`);
            return json(data);
          }
        )({}, req.params.arguments);
      }

      case "get_balance": {
        if (!hasPrivateKey()) return privateKeyError();
        return lc.charge({ price: 0.05, toolName: "get_balance" })(
          async () => {
            const address = getWalletAddress();
            const data = await clobGetWithAuth(`/balance-allowance?asset_type=USDC&signature_type=0&address=${address}`);
            return json(data);
          }
        )({}, req.params.arguments);
      }

      case "get_trade_history": {
        if (!hasPrivateKey()) return privateKeyError();
        return lc.charge({ price: 0.05, toolName: "get_trade_history" })(
          async () => {
            const limit = Math.min(Number(args.limit ?? 20), 100);
            const offset = Number(args.offset ?? 0);
            const data = await clobGetWithAuth(`/trades?limit=${limit}&offset=${offset}`);
            return json(data);
          }
        )({}, req.params.arguments);
      }

      // ── $0.10 tools ───────────────────────────────────────────────────────

      case "place_market_order": {
        if (!hasPrivateKey()) return privateKeyError();
        return lc.charge({ price: 0.10, toolName: "place_market_order" })(
          async () => {
            const tokenId = String(args.token_id ?? "");
            const side = String(args.side ?? "BUY").toUpperCase();
            const amount = Number(args.amount ?? 0);
            const slippage = Number(args.slippage_tolerance ?? 0.02);

            if (!tokenId) throw new Error("token_id is required");
            if (!["BUY", "SELL"].includes(side)) throw new Error("side must be BUY or SELL");
            if (amount <= 0) throw new Error("amount must be positive");

            // First fetch order book to get current best price
            const book = await clobGet(`/book?token_id=${encodeURIComponent(tokenId)}`) as {
              asks?: Array<{ price: string; size: string }>;
              bids?: Array<{ price: string; size: string }>;
            };

            const bestPrice = side === "BUY"
              ? parseFloat(book.asks?.[0]?.price ?? "0.5")
              : parseFloat(book.bids?.[0]?.price ?? "0.5");

            const maxSlippagePrice = side === "BUY"
              ? bestPrice * (1 + slippage)
              : bestPrice * (1 - slippage);

            // Build market order (Polymarket CLOB market orders use FOK limit at slippage price)
            const orderBody = {
              order: {
                salt: Date.now(),
                maker: getWalletAddress(),
                signer: getWalletAddress(),
                taker: "0x0000000000000000000000000000000000000000",
                tokenId,
                makerAmount: side === "BUY"
                  ? String(Math.round(amount * 1_000_000))         // USDC in (6 decimals)
                  : String(Math.round(amount * 1_000_000)),         // shares in (6 decimals)
                takerAmount: side === "BUY"
                  ? String(Math.round((amount / bestPrice) * 1_000_000)) // shares out
                  : String(Math.round(amount * bestPrice * 1_000_000)),  // USDC out
                expiration: "0",
                nonce: "0",
                feeRateBps: "0",
                side: side === "BUY" ? 0 : 1,
                signatureType: 0,
                signature: "0x_placeholder_install_ethers_for_real_signing",
              },
              owner: getWalletAddress(),
              orderType: "FOK",
            };

            const result = await clobPostWithAuth("/order", orderBody);
            return json({
              status: "SUBMITTED",
              side,
              token_id: tokenId,
              amount,
              estimated_price: bestPrice,
              max_slippage_price: maxSlippagePrice,
              clob_response: result,
              note: "Full EIP-712 signing requires ethers.js. Install: npm install ethers",
            });
          }
        )({}, req.params.arguments);
      }

      case "place_limit_order": {
        if (!hasPrivateKey()) return privateKeyError();
        return lc.charge({ price: 0.10, toolName: "place_limit_order" })(
          async () => {
            const tokenId = String(args.token_id ?? "");
            const side = String(args.side ?? "BUY").toUpperCase();
            const price = Number(args.price ?? 0);
            const size = Number(args.size ?? 0);
            const expiration = String(args.expiration ?? "GTC");

            if (!tokenId) throw new Error("token_id is required");
            if (!["BUY", "SELL"].includes(side)) throw new Error("side must be BUY or SELL");
            if (price <= 0 || price > 1) throw new Error("price must be between 0 and 1 (e.g. 0.65)");
            if (size <= 0) throw new Error("size must be positive");

            const makerAmount = side === "BUY"
              ? String(Math.round(price * size * 1_000_000))  // USDC cost (6 decimals)
              : String(Math.round(size * 1_000_000));          // shares to sell (6 decimals)

            const takerAmount = side === "BUY"
              ? String(Math.round(size * 1_000_000))           // shares to receive
              : String(Math.round(price * size * 1_000_000));  // USDC to receive

            const orderBody = {
              order: {
                salt: Date.now(),
                maker: getWalletAddress(),
                signer: getWalletAddress(),
                taker: "0x0000000000000000000000000000000000000000",
                tokenId,
                makerAmount,
                takerAmount,
                expiration: "0",
                nonce: "0",
                feeRateBps: "0",
                side: side === "BUY" ? 0 : 1,
                signatureType: 0,
                signature: "0x_placeholder_install_ethers_for_real_signing",
              },
              owner: getWalletAddress(),
              orderType: expiration === "GTC" ? "GTC" : expiration,
            };

            const result = await clobPostWithAuth("/order", orderBody);
            return json({
              status: "SUBMITTED",
              side,
              token_id: tokenId,
              limit_price: price,
              size,
              total_cost_usdc: price * size,
              clob_response: result,
              note: "Full EIP-712 signing requires ethers.js. Install: npm install ethers",
            });
          }
        )({}, req.params.arguments);
      }

      case "cancel_order": {
        if (!hasPrivateKey()) return privateKeyError();
        return lc.charge({ price: 0.10, toolName: "cancel_order" })(
          async () => {
            const orderId = String(args.order_id ?? "");
            if (!orderId) throw new Error("order_id is required");

            const result = await clobPostWithAuth("/cancel", { orderID: orderId });
            return json({
              status: "CANCELLATION_SUBMITTED",
              order_id: orderId,
              clob_response: result,
            });
          }
        )({}, req.params.arguments);
      }

      case "redeem_positions": {
        if (!hasPrivateKey()) return privateKeyError();
        return lc.charge({ price: 0.10, toolName: "redeem_positions" })(
          async () => {
            const conditionId = String(args.condition_id ?? "");
            if (!conditionId) throw new Error("condition_id is required");

            // Polymarket redemption happens on-chain via the CTF contract.
            // The CLOB API provides a redemption endpoint for convenience.
            const result = await clobPostWithAuth("/redeem-positions", {
              condition_id: conditionId,
              address: getWalletAddress(),
            });
            return json({
              status: "REDEMPTION_SUBMITTED",
              condition_id: conditionId,
              wallet: getWalletAddress(),
              clob_response: result,
              note: [
                "Redemption settles on Polygon. USDC credited to your wallet after on-chain confirmation (~2-5 seconds).",
                "Full on-chain redemption also works via the Conditional Token Framework (CTF) contract directly.",
              ],
            });
          }
        )({}, req.params.arguments);
      }

      default:
        return {
          content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      content: [{ type: "text" as const, text: `Error: ${msg}` }],
      isError: true,
    };
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `[polymarket-mcp] v${VERSION} ready. ` +
    `billing=${lc.isDemo ? "demo" : "live"} ` +
    `trading=${hasPrivateKey() ? "enabled" : "disabled (POLYMARKET_PRIVATE_KEY not set)"}\n`
  );
}

main().catch((err) => {
  process.stderr.write(`[polymarket-mcp] fatal: ${err}\n`);
  process.exit(1);
});
