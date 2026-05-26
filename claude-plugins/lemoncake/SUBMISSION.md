# Claude Code Plugin Directory Submission — LemonCake

Submission destination: **community marketplace** (`anthropics/claude-plugins-community`).
Form URL: <https://claude.ai/settings/plugins/submit> (or <https://platform.claude.com/plugins/submit>).

Per Anthropic docs (5/26/2026): the official `claude-plugins-official` is curated separately with no application. We submit to community marketplace for `@claude-community/lemoncake` install.

---

## Pre-flight checklist (run before submission)

- [ ] `claude plugin validate ./claude-plugins/lemoncake` returns clean
- [ ] `plugin.json` version matches the latest agent-payment-mcp npm release (currently `0.5.1` — bump in sync with mcp-server/package.json)
- [ ] Repository `https://github.com/evidai/agent-payment-mcp` is public + has the plugin path committed to `main`
- [ ] `.mcp.json` `command: npx -y *@latest` is intentional (auto-update). If you want pinned versions, swap `@latest` for `@0.5.1` etc.
- [ ] `lemoncake.xyz/pricing` returns 200 (the README links there)
- [ ] `lemoncake.xyz/start/free` returns 200 (the README links there)

---

## Submission form fields (paste into claude.ai/settings/plugins/submit)

> **Note:** the exact field names depend on the live form. If a field below doesn't appear, skip it. If a new field appears, fill it from the README content.

### Plugin name
```
lemoncake
```

### Repository URL
```
https://github.com/evidai/agent-payment-mcp
```

### Plugin path within the repo
```
claude-plugins/lemoncake
```

### Author name
```
evidai
```

### Author email
```
contact@aievid.com
```

### Short description (one line, for the marketplace listing)
```
Non-custodial USDC pay-per-call for AI agents. MPP-compatible Base/USDC facilitator + 4 trade-stack tools. Free 1k tx/mo, gas sponsored.
```

### Long description (markdown OK)
```markdown
LemonCake bundles five production MCP servers behind one plugin:

- **agent-payment-mcp** — x402 + MPP-compatible facilitator client. ERC-2612 permit signing, settles MPP-signed payments on Base/USDC. Demo mode works without env config.
- **xstocks-mcp** — Solana xStocks (AAPLx/TSLAx/SPYx) via Jupiter DEX. Hard daily USD cap.
- **tokenized-stock-mcp** — Dinari dShares tokenized US stocks. Non-custodial.
- **alpaca-guard-mcp** — Alpaca trading API with daily cap guard. Paper by default.
- **gmx-mcp** — GMX v2 perps on Arbitrum (AAPL/TSLA/NVDA long-or-short, USDC collateral).

**Why it's different**:
1. Non-custodial — buyer holds wallet keys, LemonCake never touches USDC. FSA Q1-Q11 inquiry completed (Japan), registration-exempt.
2. MPP-compatible — accepts Stripe Machine Payments Protocol-signed payments alongside x402, settling on Base/USDC.
3. Free 1k tx/mo with gas sponsored on Base. $0.005/tx after.
4. Native JP onramp — only x402 facilitator that serves Japan (Stripe Crypto Onramp is JP-blocked).

**Tier-0 install** uses `npx -y` for every server — no manual install, no env vars required to boot Demo Mode.
```

### Category / tags
```
payment, monetization, x402, agent-commerce, stablecoin, usdc, non-custodial, mpp, base
```

### Homepage / website
```
https://lemoncake.xyz
```

### License
```
MIT
```

### Security / safety notes (if the form has one)
```
LemonCake is non-custodial by architecture. The plugin's MCP servers never request or store the user's wallet private keys.

For paid services beyond the demo set, the user signs one ERC-2612 permit out-of-band (at lemoncake.xyz/start/v2) and pastes the resulting EIP-712 signature blob into env. The permit caps spend on-chain ($25/day default, 90-day expiry) — the spender contract address is the only `transferFrom` caller, enforced by USDC's ERC-2612 implementation.

Trade-stack servers (xstocks/tokenized-stock/alpaca-guard/gmx) default to dry-run / paper / sandbox. Live trading requires explicit opt-in env vars per server. Each has a server-side hard daily USD cap that the agent literally cannot exceed.

External Q1-Q11 inquiry with Japan FSA confirmed the SDK-distribution model does not require crypto-asset business operator registration. Independent security audit cleared.
```

---

## After submission

1. **Local validate**: run `claude plugin validate ./claude-plugins/lemoncake` and capture output for your records.
2. **Track review**: review pipeline syncs nightly. Watch [`anthropics/claude-plugins-community/.claude-plugin/marketplace.json`](https://github.com/anthropics/claude-plugins-community/blob/main/.claude-plugin/marketplace.json) for the listing to appear.
3. **Bump trigger**: every commit to your repo that touches the plugin path → CI auto-bumps the pin in the community catalog. So minor edits don't require resubmission.
4. **Cross-link**: once `@claude-community/lemoncake` is installable, update:
   - `lemoncake.xyz/pricing` — add a "Install via Claude Code" CTA
   - `lemoncake.xyz/about/en` — same
   - All 5 MCP READMEs — add a `@claude-community/lemoncake` badge

---

## Notes

- This submission is to the **community marketplace**, distinct from the older Anthropic Directory submission (5/8/2026, still in review — see `marketing/ANTHROPIC-DIRECTORY-FOLLOWUP.md`). The two surfaces don't collide; ideally we get into both.
- The plugin path inside the repo is `claude-plugins/lemoncake/` (not the repo root). That's the form value for "plugin path".
- If the form requires a single `.zip` archive, run:
  ```bash
  cd claude-plugins/lemoncake && zip -r ../lemoncake-claude-plugin.zip . -x "*.DS_Store"
  ```
  The resulting `lemoncake-claude-plugin.zip` is the upload artifact.

---

## What to do if it's rejected

Common reasons + remediation:

1. **"Plugin spawns 5 MCP servers — too heavy"** → split into two plugins: `lemoncake-payment` (just agent-payment-mcp) and `lemoncake-trade-stack` (the 4 trade tools). The payment one is the priority; the trade stack can wait.
2. **"npx auto-fetch is a security risk"** → switch `.mcp.json` to pinned `@0.5.1` etc. and commit to bumping manually.
3. **"Description references competitors (Stripe MPP, Coinbase x402)"** → strip competitor names, focus only on what LemonCake itself does.
4. **"License field missing/ambiguous"** → confirm MIT on every linked sub-package's `package.json`.
