# @lemon-cake/mcp-sdk

**AI-native usage billing SDK.** Add per-call USDC billing to any MCP server or HTTP API in one line of code. MIT — the open core of [LemonCake](https://lemoncake.xyz).

[![npm](https://img.shields.io/npm/v/@lemon-cake/mcp-sdk)](https://www.npmjs.com/package/@lemon-cake/mcp-sdk)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Open core](https://img.shields.io/badge/model-open--core-brightgreen.svg)](https://lemoncake.xyz)
[![FSA-confirmed](https://img.shields.io/badge/Japan_FSA-non--custodial-blue)](https://lemoncake.xyz/security)

## MCP — `lc.charge()`

```typescript
import { createLemonCakeSDK } from "@lemon-cake/mcp-sdk";

const lc = createLemonCakeSDK();              // demo mode without env vars

server.tool("search", lc.charge({ price: 0.02 }), async ({ query }) => {
  return await myActualSearch(query);
});
```

## HTTP — `lc.protect()` *(new in v0.3)*

```typescript
import { createLemonCakeSDK } from "@lemon-cake/mcp-sdk";

const lc = createLemonCakeSDK();

app.use(lc.protect("/api/search", { cost: 0.02 }));

app.get("/api/search", async (req, res) => {
  res.json(await myActualSearch(req.query.q));
});
```

`protect()` is an Express / Connect / Polka-compatible middleware. The buyer's pay token is read from `Authorization: Bearer …`, `X-LemonCake-Pay-Token`, or `?payToken=…`. Pre-flight hits the LemonCake API; charge is recorded after the response flushes. Demo mode (no `LEMONCAKE_SELLER_KEY`) logs to stderr instead of charging.

> **🍋 v2 (non-custodial) verifier shipped.** As of the 2026-05-21 Japan
> FSA Fintech Support Desk ruling (Q11), LemonCake operates as a pure SDK
> provider — we never touch user USDC. Buyers sign one ERC-2612 permit
> (90-day validity) and your MCP server can verify it in ~10ms with no
> RPC calls. The legacy custody path stays supported alongside.

```typescript
// Non-custodial path (new) — verify the buyer's ERC-2612 permit:
import { verifyPermitToken } from "@lemon-cake/mcp-sdk";

const permit = await verifyPermitToken(process.env.LEMON_CAKE_PERMIT!, {
  expectedSpender: "0xYourReceiverAddress",
  minValueBaseUnits: 50_000n, // $0.05 minimum
});
// permit.owner / permit.value / permit.deadline are now safe to use.
```

---

## Table of Contents

- [Installation](#installation)
- [Quick Start (3 lines)](#quick-start-3-lines)
- [Demo Mode](#demo-mode)
- [How It Works](#how-it-works)
- [API Reference](#api-reference)
  - [createLemonCakeSDK(config)](#createlemoncakesdkconfig)
  - [lc.charge(options)](#lcchargeoptions)
  - [lc.middleware(config)](#lcmiddlewareconfig)
  - [lc.getEarnings()](#lcgetearnings)
- [Pay Token Sources](#pay-token-sources)
- [Free Tier](#free-tier)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)
- [x402 Header Compatibility](#x402-header-compatibility)
- [Pricing Guide](#pricing-guide)
- [Registering on the LemonCake Marketplace](#registering-on-the-lemoncake-marketplace)
- [Environment Variables](#environment-variables)

---

## Installation

```bash
npm install @lemon-cake/mcp-sdk @modelcontextprotocol/sdk
```

Requires Node.js >= 18 and `@modelcontextprotocol/sdk` >= 1.10.0.

---

## Quick Start (3 lines)

**Step 1.** Get a seller key from [lemoncake.xyz/dashboard](https://lemoncake.xyz/dashboard).

**Step 2.** Add three lines to your existing MCP server:

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createLemonCakeSDK } from "@lemon-cake/mcp-sdk";       // line 1

const lc = createLemonCakeSDK({                                 // line 2
  sellerKey: process.env.LEMONCAKE_SELLER_KEY,
});

const server = new Server({ name: "my-server", version: "1.0.0" }, { capabilities: { tools: {} } });

// line 3: wrap your handler with lc.charge()
const myHandler = lc.charge({ price: 0.05 })(async (params) => {
  return { content: [{ type: "text", text: "result" }] };
});

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name === "my_tool") return myHandler(req.params.arguments ?? {}, req.params);
  throw new Error("Unknown tool");
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

**Step 3.** Set the seller key:

```bash
export LEMONCAKE_SELLER_KEY=<your-seller-key-from-dashboard>
```

That's it. Every call to `my_tool` now:
1. Checks the buyer's Pay Token balance
2. Runs your handler only if they have sufficient funds
3. Charges `$0.05 USDC` on success
4. Returns a `402`-equivalent MCP error if they're out of funds

---

## Demo Mode

If `LEMONCAKE_SELLER_KEY` is not set (and not passed in config), the SDK enters **Demo Mode**:

- No real API calls are made to LemonCake
- Tool handlers still execute normally
- A log line is printed for each "charge" that would have occurred
- The first text content block gets a `[DEMO]` notice prepended

Demo Mode is useful for:
- Local development without a seller account
- CI/CD environments
- Testing tool logic before going live

```typescript
const lc = createLemonCakeSDK(); // No seller key → Demo Mode

console.log(lc.isDemo); // true
```

---

## How It Works

```
Agent → MCP Tool Call → SDK wrapper
                           │
                    ┌──────▼────────┐
                    │  Rate limit?  │ ← in-memory, per token per tool
                    └──────┬────────┘
                           │ pass
                    ┌──────▼────────┐
                    │  Free tier?   │ ← in-memory, per token per tool
                    └──────┬────────┘
                    │ quota exhausted
                    ┌──────▼──────────────┐
                    │  POST /api/sdk/     │
                    │  preflight          │ ← verify Pay Token + check balance
                    └──────┬──────────────┘
                           │ allowed
                    ┌──────▼────────┐
                    │  Run handler  │ ← your original tool logic
                    └──────┬────────┘
                           │ result
                    ┌──────▼──────────────┐
                    │  POST /api/sdk/     │
                    │  charge             │ ← confirm (success) or cancel (error)
                    └─────────────────────┘
```

The preflight step creates a `PENDING` Charge record in the database. The charge step either:
- Confirms it: deducts USDC from the buyer's balance and enqueues the USDC transfer
- Cancels it: marks it `FAILED` (no money moved)

This two-phase design ensures the buyer is only charged if your tool actually ran successfully.

---

## API Reference

### `createLemonCakeSDK(config)`

Creates and returns a `LemonCakeSDK` instance.

```typescript
const lc = createLemonCakeSDK({
  sellerKey?: string;       // Your seller key. Defaults to LEMONCAKE_SELLER_KEY env var.
  serviceId?: string;       // Your service ID from the marketplace. Used for earnings tracking.
  apiUrl?: string;          // Override API URL. Defaults to https://api.lemoncake.xyz
  defaultPayToken?: string; // Fallback Pay Token if not in _meta or env.
});
```

**Returns:** `LemonCakeSDK` with properties:
- `lc.isDemo: boolean` — true if running without a seller key
- `lc.apiUrl: string` — the resolved API URL

---

### `lc.charge(options)`

Wraps a single tool handler with per-call USDC billing.

```typescript
const wrappedHandler = lc.charge({
  price: 0.05,      // Required. Price in USDC per call.
  freeCalls?: 10,   // Optional. N free calls before billing starts (in-memory, per token).
  toolName?: string;// Optional. Override tool name in charge metadata.
  rateLimit?: 30,   // Optional. Max calls per minute per Pay Token (in-memory).
  x402Headers?: true// Optional. Attach charge receipt to response (default: true).
})(handler);
```

**Usage patterns:**

```typescript
// Pattern A: wrap handler directly
const paidHandler = lc.charge({ price: 0.05 })(async (params) => {
  return { content: [{ type: "text", text: "result" }] };
});

// Pattern B: inline in tool registration
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  return lc.charge({ price: 0.01 })(myHandler)(req.params.arguments, req.params);
});
```

---

### `lc.middleware(config)`

Builds a global interceptor for all tools in one config.

```typescript
const mw = lc.middleware({
  defaultPrice: 0.01,           // Required. Default price for all tools.
  perTool?: {                   // Optional. Per-tool price overrides.
    heavy_search: 0.25,
    cheap_ping: 0.001,
  },
  freeCalls?: 5,                // Optional. Free calls per token (applies to all tools).
  rateLimit?: 60,               // Optional. Global rate limit per token.
});

// Use in handler:
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  return mw.intercept(req.params.name, myHandlers[req.params.name], req.params.arguments, req.params);
});
```

---

### `lc.getEarnings()`

Fetch cumulative USDC earnings for your seller account.

```typescript
const earnings = await lc.getEarnings();
// {
//   totalEarned: "12.345678",  // All-time USDC earned
//   todayEarned: "0.250000",   // Today's USDC earned
//   callCount: 247,             // Total completed charges
//   serviceId: "abc123",        // Your service ID (if configured)
// }
```

Returns zeroed data in Demo Mode (no error thrown).

---

## Pay Token Sources

The SDK resolves the buyer's Pay Token in this order:

1. **MCP `_meta.payToken`** — the agent passes it in the tool call's `_meta` field
2. **`LEMONCAKE_PAY_TOKEN` env var** — set by the server operator for a fixed buyer
3. **`config.defaultPayToken`** — SDK-level fallback

If no Pay Token is found, the SDK returns a `402`-equivalent MCP error with instructions.

Buyers obtain Pay Tokens from [lemoncake.xyz/dashboard](https://lemoncake.xyz/dashboard) → Tokens → Issue Pay Token.

---

## Free Tier

Offer N free calls per buyer before billing starts:

```typescript
lc.charge({ price: 0.01, freeCalls: 10 })(handler)
// First 10 calls per Pay Token: free
// Call 11+: $0.01 USDC each
```

Free tier counters are stored in-memory and reset on process restart. This is intentional — free tiers are a conversion tool, not an accounting record.

---

## Rate Limiting

Protect against abuse with per-token, per-tool rate limiting:

```typescript
lc.charge({ price: 0.05, rateLimit: 30 })(handler)
// Max 30 calls per minute per Pay Token
// Over-limit calls return a 429-equivalent MCP error
```

Rate limit counters are also in-memory and reset on process restart.

---

## Error Handling

The SDK **never throws**. All errors are returned as `MCPToolResult` with `isError: true`. This is the MCP-idiomatic way to signal errors — clients receive a structured error, not an exception.

Error response shape:

```json
{
  "content": [{
    "type": "text",
    "text": "{\"error\": \"Insufficient balance: 0.003400 USDC available, 0.050000 required\", \"code\": \"INSUFFICIENT_FUNDS\", \"lemoncake\": true, \"remainingUsdc\": \"0.003400\", \"requiredUsdc\": \"0.050000\"}"
  }],
  "isError": true
}
```

Error codes:

| Code | Meaning |
|------|---------|
| `INSUFFICIENT_FUNDS` | Buyer's balance or token limit is too low |
| `TOKEN_EXPIRED` | Pay Token has expired |
| `TOKEN_REVOKED` | Pay Token was revoked by the buyer |
| `TOKEN_LIMIT_EXCEEDED` | The token's per-token spending cap was hit |
| `RATE_LIMITED` | Too many calls per minute |
| `INVALID_TOKEN` | Token is malformed or missing |
| `API_ERROR` | LemonCake API returned an unexpected error |
| `SELLER_KEY_MISSING` | Seller key not configured (should not happen in non-demo mode) |

---

## x402 Header Compatibility

The SDK is compatible with the [x402 payment protocol](https://x402.org). When `x402Headers: true` (the default):

- Successful charges append a charge receipt to the response content:
  ```
  [LemonCake] Charged $0.050000 USDC (chargeId: ch_abc123)
  ```
- Insufficient balance errors include an `x402` field:
  ```json
  { "x402": { "header": "X-Payment-Required: lemoncake-pay-token", "amount": "0.050000", "asset": "USDC" } }
  ```

This lets agents using x402-aware frameworks parse payment signals without SDK-specific logic.

---

## Pricing Guide

Recommended price ranges:

| Tool Type | Price Range | Example |
|-----------|-------------|---------|
| Simple lookup (weather, exchange rate) | $0.001–$0.005 | `$0.002` |
| Standard API call (search, fetch) | $0.005–$0.05 | `$0.01` |
| Enriched data (patent search, legal) | $0.05–$0.20 | `$0.10` |
| AI-powered analysis | $0.10–$0.50 | `$0.25` |
| Premium / real-time data | $0.25–$1.00 | `$0.50` |

**Tips:**
- Start low and raise prices based on demand signals
- Offer `freeCalls: 5–10` to reduce buyer friction on first use
- Use `perTool` in middleware to charge differently for compute-heavy vs light tools
- LemonCake takes a platform fee (currently 10%); your net is `price × 0.90`

---

## Registering on the LemonCake Marketplace

1. Go to [lemoncake.xyz/dashboard/services](https://lemoncake.xyz/dashboard/services)
2. Click **Register a Service**
3. Fill in: name, description, endpoint, category, and `pricePerCallUsdc`
4. Submit for review (typically reviewed within 48 hours)
5. Once approved (`reviewStatus: APPROVED`), your service appears in the marketplace
6. Copy your `serviceId` and pass it to `createLemonCakeSDK({ serviceId })` for earnings tracking

For SDK-based tools (rather than proxy-based), set the service type to `MCP`.

Documentation: [lemoncake.xyz/docs/sellers](https://lemoncake.xyz/docs/sellers)

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LEMONCAKE_SELLER_KEY` | Yes (for live mode) | Your seller key (Buyer JWT from dashboard). Omit for Demo Mode. |
| `LEMONCAKE_SERVICE_ID` | Recommended | Your service ID for earnings tracking and charge attribution. |
| `LEMONCAKE_PAY_TOKEN` | No | Fallback Pay Token for the buyer. Usually agents pass this via `_meta.payToken`. |
| `LEMONCAKE_API_URL` | No | Override API URL. Default: `https://api.lemoncake.xyz` |

---

## License

MIT — [lemoncake.xyz](https://lemoncake.xyz)
