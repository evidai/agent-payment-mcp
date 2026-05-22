/**
 * サブスクリプションプラン定義 — single source of truth.
 *
 * 価格と quota はここだけで管理する。charges-permit.ts /
 * subscriptions.ts / dashboard すべてこのテーブルを参照する。
 *
 * 設計方針（戦略メモ参照）:
 *   - per-call は x402 と同価格で底固定（commodity 化、価格を購買決定から外す）
 *   - 真の収益は月額サブスク（freee/MF 仕訳、インボイス、JPY オフランプ）
 *   - Business 以上は per-call も少し安く（量割引で乗り換え誘導）
 */

import type { SubscriptionPlan } from "@prisma/client";

export interface PlanConfig {
  /** 月額（JPY） */
  monthlyJpy:        number;
  /** 月間無料 call 数（これを超えたら overage を徴収） */
  freeCallsPerMonth: number;
  /** 1 call あたりの超過課金（USDC、6 decimals） */
  overagePerCallUsdc: string;
  /** 機能フラグ — Pro+ で会計連携 / インボイス自動発行が有効 */
  features: {
    accountingIntegration: boolean;
    invoiceGeneration:     boolean;
    jpyOfframp:            boolean;
    multiWallet:           boolean;
    sla999:                boolean;
  };
  /** Stripe Price ID（env から注入。FREE は null） */
  stripePriceEnv:    string | null;
}

export const PLAN_CONFIG: Record<SubscriptionPlan, PlanConfig> = {
  FREE: {
    monthlyJpy:         0,
    freeCallsPerMonth:  1000,
    overagePerCallUsdc: "0.001",
    features: {
      accountingIntegration: false,
      invoiceGeneration:     false,
      jpyOfframp:            false,
      multiWallet:           false,
      sla999:                false,
    },
    stripePriceEnv:    null,
  },
  PRO: {
    monthlyJpy:         2980,
    freeCallsPerMonth:  10000,
    overagePerCallUsdc: "0.001",
    features: {
      accountingIntegration: true,
      invoiceGeneration:     true,
      jpyOfframp:            false,
      multiWallet:           false,
      sla999:                false,
    },
    stripePriceEnv:    "STRIPE_PRICE_PRO",
  },
  BUSINESS: {
    monthlyJpy:         9800,
    freeCallsPerMonth:  100000,
    overagePerCallUsdc: "0.0008",
    features: {
      accountingIntegration: true,
      invoiceGeneration:     true,
      jpyOfframp:            true,
      multiWallet:           true,
      sla999:                true,
    },
    stripePriceEnv:    "STRIPE_PRICE_BUSINESS",
  },
  ENTERPRISE: {
    monthlyJpy:         0,  // 個別見積もり
    freeCallsPerMonth:  Number.MAX_SAFE_INTEGER,  // 実質無制限（取扱いは別途）
    overagePerCallUsdc: "0.0005",
    features: {
      accountingIntegration: true,
      invoiceGeneration:     true,
      jpyOfframp:            true,
      multiWallet:           true,
      sla999:                true,
    },
    stripePriceEnv:    null,  // Enterprise は手動契約
  },
};

/**
 * Provider のプラン設定を取得（subscription が無ければ FREE）。
 * charges-permit ルートと invoices ルートの両方から呼ぶ。
 */
export function resolvePlanFromName(plan: SubscriptionPlan | null | undefined): PlanConfig {
  if (!plan) return PLAN_CONFIG.FREE;
  return PLAN_CONFIG[plan] ?? PLAN_CONFIG.FREE;
}

export function stripePriceIdFor(plan: SubscriptionPlan): string | null {
  const envKey = PLAN_CONFIG[plan]?.stripePriceEnv;
  if (!envKey) return null;
  return process.env[envKey] ?? null;
}
