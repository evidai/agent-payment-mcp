// Daily-cap ledger for tokenized-stock-mcp. Lives at ~/.tokenized-stock/cap.json
// (separate file from alpaca-guard's so the two MCPs maintain independent caps).
//
// Note: this is the v0.1 local-ledger mode. v0.2 will swap to LemonCake's
// remote Pay Token preflight when the upstream endpoint exists (issue #4 on
// evidai/lemon-cake).

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const DEFAULT_DAILY_LIMIT_USD = 25;
const LEDGER_DIR  = process.env.TOKENIZED_STOCK_LEDGER_DIR ?? path.join(os.homedir(), ".tokenized-stock");
const LEDGER_FILE = path.join(LEDGER_DIR, "cap.json");

// H-4 of 2026-05 @kleosr forensic audit — serialise read/modify/write.
let mutexChain: Promise<unknown> = Promise.resolve();
function withLedgerLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = mutexChain.then(fn, fn);
  mutexChain = next.catch(() => undefined);
  return next;
}
async function atomicWrite(p: string, contents: string): Promise<void> {
  const tmp = `${p}.${process.pid}.tmp`;
  await fs.writeFile(tmp, contents);
  await fs.rename(tmp, p);
}

export type LedgerState = {
  dailyLimitUsd:  number;
  todayDate:      string;
  todayUsedUsd:   number;
  lifetimeOrders: number;
  history: Array<{
    date:       string;
    notional:   number;
    feeUsd:     number;
    orderId:    string;
    symbol:     string;
    side:       "buy" | "sell";
    at:         string;
  }>;
};

function today() { return new Date().toISOString().slice(0, 10); }

function empty(): LedgerState {
  return {
    dailyLimitUsd:  DEFAULT_DAILY_LIMIT_USD,
    todayDate:      today(),
    todayUsedUsd:   0,
    lifetimeOrders: 0,
    history:        [],
  };
}

export async function load(): Promise<LedgerState> {
  try {
    const raw = await fs.readFile(LEDGER_FILE, "utf8");
    const data = JSON.parse(raw) as LedgerState;
    if (data.todayDate !== today()) {
      data.todayDate    = today();
      data.todayUsedUsd = 0;
    }
    return data;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      const fresh = empty();
      await save(fresh);
      return fresh;
    }
    throw e;
  }
}

export async function save(s: LedgerState): Promise<void> {
  await fs.mkdir(LEDGER_DIR, { recursive: true });
  await atomicWrite(LEDGER_FILE, JSON.stringify(s, null, 2));
}

export async function setDailyLimit(limitUsd: number): Promise<LedgerState> {
  if (!Number.isFinite(limitUsd) || limitUsd < 0) {
    throw new Error("dailyLimitUsd must be a non-negative finite number");
  }
  return withLedgerLock(async () => {
    const s = await load();
    s.dailyLimitUsd = limitUsd;
    await save(s);
    return s;
  });
}

export type Preflight =
  | { allowed: true;  remainingUsd: number; usedUsd: number; limitUsd: number }
  | { allowed: false; remainingUsd: number; usedUsd: number; limitUsd: number; hint: string };

export async function preflight(notionalUsd: number): Promise<Preflight> {
  const s = await load();
  const remaining = Math.max(0, s.dailyLimitUsd - s.todayUsedUsd);
  if (notionalUsd <= remaining) {
    return { allowed: true, remainingUsd: remaining, usedUsd: s.todayUsedUsd, limitUsd: s.dailyLimitUsd };
  }
  return {
    allowed:      false,
    remainingUsd: remaining,
    usedUsd:      s.todayUsedUsd,
    limitUsd:     s.dailyLimitUsd,
    hint: `This trade would cost ~$${notionalUsd.toFixed(2)} but only $${remaining.toFixed(2)} remains under today's $${s.dailyLimitUsd.toFixed(2)} cap. Either (a) wait until tomorrow (UTC), (b) ask the human operator to call guard_set_limit to raise the cap, or (c) split into smaller buys. The agent cannot override this from inside a tool call.`,
  };
}

export async function recordCharge(opts: {
  notionalUsd: number;
  feeUsd:      number;
  orderId:     string;
  symbol:      string;
  side:        "buy" | "sell";
}): Promise<LedgerState> {
  return withLedgerLock(async () => {
    const s = await load();
    s.todayUsedUsd  += opts.notionalUsd;
    s.lifetimeOrders += 1;
    s.history.unshift({
      date:     s.todayDate,
      notional: opts.notionalUsd,
      feeUsd:   opts.feeUsd,
      orderId:  opts.orderId,
      symbol:   opts.symbol,
      side:     opts.side,
      at:       new Date().toISOString(),
    });
    s.history = s.history.slice(0, 100);
    await save(s);
    return s;
  });
}

export async function status() {
  const s = await load();
  return {
    ...s,
    remainingUsd: Math.max(0, s.dailyLimitUsd - s.todayUsedUsd),
    ledgerFile:   LEDGER_FILE,
  };
}
