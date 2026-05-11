// Daily-cap ledger at ~/.xstocks/cap.json. Independent of alpaca-guard's
// and tokenized-stock's so the three caps don't compete or pollute each other.
//
// Same pattern as the siblings: UTC midnight rollover, last 100 trades, simple JSON.

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const DEFAULT_DAILY_LIMIT_USD = 25;
const LEDGER_DIR  = process.env.XSTOCKS_LEDGER_DIR ?? path.join(os.homedir(), ".xstocks");
const LEDGER_FILE = path.join(LEDGER_DIR, "cap.json");

export type LedgerState = {
  dailyLimitUsd:  number;
  todayDate:      string;
  todayUsedUsd:   number;
  lifetimeOrders: number;
  history: Array<{
    date:     string;
    notional: number;
    feeUsd:   number;
    txSig:    string;
    symbol:   string;
    side:     "buy" | "sell";
    at:       string;
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
  await fs.writeFile(LEDGER_FILE, JSON.stringify(s, null, 2));
}

export async function setDailyLimit(limitUsd: number): Promise<LedgerState> {
  if (!Number.isFinite(limitUsd) || limitUsd < 0) {
    throw new Error("dailyLimitUsd must be a non-negative finite number");
  }
  const s = await load();
  s.dailyLimitUsd = limitUsd;
  await save(s);
  return s;
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
    hint: `This swap would cost ~$${notionalUsd.toFixed(2)} but only $${remaining.toFixed(2)} remains under today's $${s.dailyLimitUsd.toFixed(2)} cap. Either (a) wait until tomorrow (UTC), (b) ask the human operator to call guard_set_limit to raise the cap, or (c) split into smaller buys. The agent cannot override this from inside a tool call.`,
  };
}

export async function recordTrade(opts: {
  notionalUsd: number;
  feeUsd:      number;
  txSig:       string;
  symbol:      string;
  side:        "buy" | "sell";
}): Promise<LedgerState> {
  const s = await load();
  s.todayUsedUsd  += opts.notionalUsd;
  s.lifetimeOrders += 1;
  s.history.unshift({
    date:     s.todayDate,
    notional: opts.notionalUsd,
    feeUsd:   opts.feeUsd,
    txSig:    opts.txSig,
    symbol:   opts.symbol,
    side:     opts.side,
    at:       new Date().toISOString(),
  });
  s.history = s.history.slice(0, 100);
  await save(s);
  return s;
}

export async function status() {
  const s = await load();
  return {
    ...s,
    remainingUsd: Math.max(0, s.dailyLimitUsd - s.todayUsedUsd),
    ledgerFile:   LEDGER_FILE,
  };
}
