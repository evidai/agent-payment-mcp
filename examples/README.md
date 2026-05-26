# LemonCake examples

Working starter templates for adding usage billing to your AI APIs and MCP servers. **Every example here is a complete, runnable project — not a stub.** Fork freely.

[![License](https://img.shields.io/badge/license-MIT-green)](../LICENSE)
[![SDK](https://img.shields.io/badge/SDK-%40lemon--cake%2Fmcp--sdk-blueviolet)](https://www.npmjs.com/package/@lemon-cake/mcp-sdk)

---

## Available now

| Example | Stack | What it shows |
|---|---|---|
| **[mcp-monetization-starter](./mcp-monetization-starter/)** | Node + MCP SDK | Minimal MCP server with 2 paid tools (`$0.02`, `$0.05`). Demo mode works out of the box. |

## Coming soon

These are tracked but not yet written. PRs welcome — see [the issue tracker](https://github.com/evidai/agent-payment-mcp/issues) or the [LemonCake Discord](#).

- `nextjs-api-billing/` — Next.js API route with per-request billing
- `fastapi-billing/` — FastAPI Python API with the same pattern
- `cloudflare-worker-billing/` — Cloudflare Worker example
- `langchain-paid-tool/` — LangChain tool wrapper that charges per invocation
- `cursor-extension-billing/` — Cursor extension with usage metering

---

## Run any example

```bash
git clone https://github.com/evidai/agent-payment-mcp
cd agent-payment-mcp/examples/<example-name>
npm install
npm start
```

All examples are MIT-licensed and dependency-light. None require an account to run in demo mode.

---

## Why these are open

The SDK + examples + adapters are open-source because:

- **Trust.** Billing infra you can't inspect is billing infra you can't trust.
- **Distribution.** Devs adopt what they can fork and reshape.
- **Floor.** If LemonCake ever pivots or disappears, the MIT code is enough to keep your integration working.

The hosted dashboard, billing engine, settlement, compliance, and abuse detection are **closed**. That's where LemonCake makes money. The SDK pipe to it is open.

This is the Supabase / Clerk / Resend pattern. We chose it deliberately.

---

## Contribute an example

If you've wired LemonCake into a stack we don't cover, send a PR to this directory. Requirements:

1. **Self-contained.** `npm install && npm start` (or the equivalent) must work, with demo mode active by default.
2. **README clarity.** What it does, how to wire it into a real app, how to switch from demo to live.
3. **MIT license.** Match the rest of the repo.

We accept any LLM stack, any framework, any language. The goal is to make "add usage billing to your AI tool" a copy-paste operation.
