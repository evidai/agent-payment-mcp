#!/usr/bin/env node
/**
 * create-lemon-mcp — scaffold a paid MCP server (sandbox-first).
 *
 * Usage:  npx create-lemon-mcp my-paid-search
 *
 * Copies template/ into the target dir, rewrites a couple of placeholders,
 * and prints next steps. No network, no keys.
 */
import { cp, readFile, writeFile, rename, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(__dirname, "..", "template");

const y = (s) => `\x1b[93m\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

async function exists(p) { try { await access(p); return true; } catch { return false; } }

async function main() {
  const name = process.argv[2] || "my-paid-mcp";
  const target = resolve(process.cwd(), name);

  if (await exists(target)) {
    console.error(`\n✗ Directory "${name}" already exists. Pick another name.\n`);
    process.exit(1);
  }

  console.log("\n" + y("🍋 create-lemon-mcp") + dim("  · scaffolding a paid MCP server (sandbox mode)\n"));

  // Copy template, then un-prefix _gitignore (npm strips real .gitignore from packages).
  await cp(TEMPLATE, target, { recursive: true });
  const gi = join(target, "_gitignore");
  if (await exists(gi)) await rename(gi, join(target, ".gitignore"));

  // Stamp the project name into package.json.
  const pkgPath = join(target, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  pkg.name = name.replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

  console.log(`  Created ${y(name)}/\n`);
  console.log("  Next:\n");
  console.log(dim("    cd ") + name);
  console.log(dim("    npm install"));
  console.log(dim("    npm run demo:agent   ") + "# see the paid-call flow (402 → mint → pay → cap) in ~10s");
  console.log(dim("    npm start            ") + "# run your paid MCP server (remote HTTP) locally\n");
  console.log(dim("  Sandbox by default — no keys, no card, no crypto.\n"));
  console.log("  Go live (no code change):\n");
  console.log(dim("    1. create an endpoint + Seller Key in ") + "https://www.lemoncake.xyz/app");
  console.log(dim("    2. set ") + "LEMONCAKE_SELLER_KEY=sk_live_…" + dim(" in .env"));
  console.log(dim("    3. ") + "npm run smoke" + dim("   # verify the charge path, then npm start\n"));
}

main().catch((e) => { console.error(e); process.exit(1); });
