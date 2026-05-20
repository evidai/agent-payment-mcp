// Local daily-cap ledger. Persisted to ~/.alpaca-guard/cap.json so the
// guard survives across MCP server restarts.
//
// We deliberately do NOT depend on LemonCake API for the v0.1 release — the
// preflight endpoint there does not exist yet. When it does, payToken.ts will
// take precedence and this file becomes the fallback path for users who run
// without LEMON_CAKE_PAY_TOKEN.

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const DEFAULT_DAILY_LIMIT_USD = 10;  // safe default for paper trading
const LEDGER_DIR  = process.env.ALPACA_GUARD_LEDGER_DIR  ?? path.join(os.homedir(), ".alpaca-guard");
const LEDGER_FILE = path.join(LEDGER_DIR, "cap.json");

// SECURITY: serialise ledger read/modify/write operations so two concurrent
// tool calls within the same MCP server process cannot both read the same
// state, both add their charge, and have the later writer overwrite the
// earlier one — losing the earlier charge from the daily total.
// (H-4 of the 2026-05 @kleosr forensic audit.)
//
// This is in-process only — a single MCP server has a single Node event
// loop so an async mutex is sufficient. If you ever run multiple processes
// against the same ledger file you must switch to an OS-level file lock.
let mutexChain: Promise<unknown> = Promise.resolve();
function withLedgerLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = mutexChain.then(fn, fn);
  mutexChain = next.catch(() => undefined);
  return next;
}

async function atomicWrite(p: string, contents: string): Promise<void> {
  // Write to a temp file in the same directory then rename — POSIX rename
  // is atomic on the same filesystem, so readers never see a partial file
  // and a crash mid-write doesn't corrupt the ledger.
  const tmp = `${p}.${process.pid}.tmp`;
  await fs.writeFile(tmp, contents);
  await fs.rename(tmp, p);
}

export type LedgerState = {
  dailyLimitUsd: number;
  todayDate:     string;   // ISO YYYY-MM-DD in UTC
  todayUsedUsd:  number;
  lifetimeOrders: number;
  history: Array<{
    date:     string;
    notional: number;
    orderId:  string;
    symbol:   string;
    side:     "buy" | "sell";
    at:       string;
  }>;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyLedger(): LedgerState {
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
    // roll over if it's a new day
    if (data.todayDate !== today()) {
      data.todayDate    = today();
      data.todayUsedUsd = 0;
    }
    return data;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      const fresh = emptyLedger();
      await save(fresh);
      return fresh;
    }
    throw e;
  }
}

export async function save(state: LedgerState): Promise<void> {
  await fs.mkdir(LEDGER_DIR, { recursive: true });
  await atomicWrite(LEDGER_FILE, JSON.stringify(state, null, 2));
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
    return {
      allowed:      true,
      remainingUsd: remaining,
      usedUsd:      s.todayUsedUsd,
      limitUsd:     s.dailyLimitUsd,
    };
  }
  return {
    allowed:      false,
    remainingUsd: remaining,
    usedUsd:      s.todayUsedUsd,
    limitUsd:     s.dailyLimitUsd,
    hint: `This order would cost ~$${notionalUsd.toFixed(2)} but only $${remaining.toFixed(2)} remains under today's $${s.dailyLimitUsd.toFixed(2)} cap. ` +
          `Either (a) wait until tomorrow (UTC), (b) call guard_set_limit to raise the cap (you decide, not the agent), ` +
          `or (c) split the order into smaller qty. The agent cannot override this from inside a tool call.`,
  };
}

export async function recordCharge(opts: {
  notionalUsd: number;
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
      orderId:  opts.orderId,
      symbol:   opts.symbol,
      side:     opts.side,
      at:       new Date().toISOString(),
    });
    // keep last 100 only
    s.history = s.history.slice(0, 100);
    await save(s);
    return s;
  });
}

export async function status(): Promise<LedgerState & { remainingUsd: number; ledgerFile: string }> {
  const s = await load();
  return {
    ...s,
    remainingUsd: Math.max(0, s.dailyLimitUsd - s.todayUsedUsd),
    ledgerFile:   LEDGER_FILE,
  };
}
