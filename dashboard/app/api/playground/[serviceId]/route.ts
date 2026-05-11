import { NextRequest, NextResponse } from "next/server";

// Live Demo Mode endpoint for the /start landing page playground.
// Mirrors call_service's response shape (status, chargeId, amountUsdc,
// response, x402Receipt) so visitors see exactly what an agent would
// receive — without installing the MCP server.
//
// No auth, no rate-limit beyond Vercel's defaults; this hits the same
// free upstreams the MCP server uses in Demo Mode.

export const runtime = "edge";

const TIMEOUT_MS = 5000;

async function withTimeout(p: Promise<Response>, ms: number) {
  const ctrl = new AbortController();
  const t    = setTimeout(() => ctrl.abort(), ms);
  try {
    return await p;
  } finally {
    clearTimeout(t);
  }
}

async function tryJson(url: string, init?: RequestInit): Promise<unknown | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    return ct.includes("application/json") ? await res.json() : await res.text();
  } catch {
    return null;
  }
}

function buildReceipt(serviceId: string, chargeId: string) {
  return {
    scheme:          "lemoncake-pay-token-v1",
    x402Compatible:  true,
    chain:           "off-chain (LemonCake Pay Token)",
    asset:           "USDC",
    amount:          "0.00",
    recipient:       serviceId,
    paymentIntentId: chargeId,
    settledAt:       new Date().toISOString(),
    note:            "Demo Mode: receipt shape is illustrative, no actual settlement.",
  };
}

const HANDLERS: Record<string, (body: Record<string, unknown>) => Promise<unknown>> = {
  async demo_search(body) {
    const q = (body.q as string | undefined)?.trim() || "Model Context Protocol";
    const data = await tryJson(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=5&format=json&namespace=0&origin=*`);
    if (Array.isArray(data) && data.length === 4 && Array.isArray(data[1])) {
      const titles       = data[1] as string[];
      const descriptions = (data[2] as string[]) ?? [];
      const urls         = (data[3] as string[]) ?? [];
      return {
        query:    q,
        results:  titles.map((t, i) => ({ title: t, snippet: descriptions[i] ?? "", url: urls[i] ?? "" })),
        upstream: "en.wikipedia.org/opensearch (real)",
      };
    }
    return {
      query:   q,
      results: [{ title: "LemonCake", url: "https://lemoncake.xyz", snippet: "Pay-per-call USDC for any HTTP API." }],
      upstream: "canned (Wikipedia unreachable)",
    };
  },

  async demo_fx() {
    const data: any = await tryJson("https://open.er-api.com/v6/latest/USD");
    if (data?.rates) {
      return {
        base:    data.base_code ?? "USD",
        rates:   { JPY: data.rates.JPY, EUR: data.rates.EUR, GBP: data.rates.GBP, CNY: data.rates.CNY, KRW: data.rates.KRW },
        asOf:    data.time_last_update_utc ?? null,
        upstream: "open.er-api.com (real)",
      };
    }
    return { base: "USD", rates: { JPY: 150.42, EUR: 0.92 }, asOf: new Date().toISOString().slice(0, 10), upstream: "canned (er-api unreachable)" };
  },

  async demo_echo(body) {
    const data = await tryJson("https://httpbin.org/anything", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    if (data) return { ...(data as object), upstream: "httpbin.org (real)" };
    return { receivedBody: body, timestamp: new Date().toISOString(), upstream: "canned (httpbin unreachable)" };
  },
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  const handler = HANDLERS[serviceId];
  if (!handler) {
    return NextResponse.json({
      status: 404,
      error:  `Unknown demo service "${serviceId}". Try demo_search / demo_fx / demo_echo.`,
    }, { status: 404 });
  }
  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    body = {};
  }

  const t0 = Date.now();
  const response = await handler(body);
  const latencyMs = Date.now() - t0;
  const chargeId = `demo_${Date.now().toString(36)}`;

  return NextResponse.json({
    status:      200,
    chargeId,
    amountUsdc:  "0.00",
    response,
    mode:        "demo",
    latencyMs,
    x402Receipt: buildReceipt(serviceId, chargeId),
    note:        "🎮 LP Demo Mode (lemoncake.xyz/start playground). Same response shape as `call_service` from `npx -y pay-per-call-mcp`. Set LEMON_CAKE_PAY_TOKEN to call real paid services.",
  });
}
