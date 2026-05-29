/**
 * サブスクリプションプラン定義 — single source of truth.
 *
 * 設計（v2 確定版）:
 *   - per-call の単価は Provider が /sellers で設定した値が真。
 *     LemonCake はこの値を override しない（per-call は 100% Provider へ）。
 *   - プランは「月間無料枠 (freeCallsPerMonth)」と「機能フラグ」だけを決める。
 *   - 収益は月額サブスク（Stripe で JPY または USD 課金）。
 *
 * Multi-currency 対応（2026-05-22）:
 *   - 日本 IP からの登録: JPY 課金（既存の STRIPE_PRICE_*）
 *   - それ以外の IP: USD 課金（STRIPE_PRICE_*_USD）
 *   - Provider はチェックアウト時に locale が決定する。
 */

import type { SubscriptionPlan } from "@prisma/client";

export type Currency = "jpy" | "usd";

export interface PlanConfig {
  /** 月額（JPY） */
  monthlyJpy:        number;
  /** 月額（USD）— global pricing */
  monthlyUsd:        number;
  /** 月間無料 call 数（LemonCake 負担。超過は Provider 設定単価で課金） */
  freeCallsPerMonth: number;
  /** 機能フラグ */
  features: {
    accountingIntegration: boolean;
    invoiceGeneration:     boolean;
    jpyOfframp:            boolean;
    multiWallet:           boolean;
    sla999:                boolean;
  };
  /** Stripe Price ID env キー — JPY 用 */
  stripePriceEnv:    string | null;
  /** Stripe Price ID env キー — USD 用 */
  stripePriceEnvUsd: string | null;
}

export const PLAN_CONFIG: Record<SubscriptionPlan, PlanConfig> = {
  FREE: {
    monthlyJpy:         0,
    monthlyUsd:         0,
    freeCallsPerMonth:  3000,
    features: {
      accountingIntegration: false,
      invoiceGeneration:     false,
      jpyOfframp:            false,
      multiWallet:           false,
      sla999:                false,
    },
    stripePriceEnv:    null,
    stripePriceEnvUsd: null,
  },
  PRO: {
    monthlyJpy:         9800,
    monthlyUsd:         69,
    freeCallsPerMonth:  10000,
    features: {
      accountingIntegration: true,
      invoiceGeneration:     true,
      jpyOfframp:            false,
      multiWallet:           false,
      sla999:                false,
    },
    stripePriceEnv:    "STRIPE_PRICE_PRO",
    stripePriceEnvUsd: "STRIPE_PRICE_PRO_USD",
  },
  BUSINESS: {
    monthlyJpy:         29800,
    monthlyUsd:         199,
    freeCallsPerMonth:  100000,
    features: {
      accountingIntegration: true,
      invoiceGeneration:     true,
      jpyOfframp:            true,
      multiWallet:           true,
      sla999:                true,
    },
    stripePriceEnv:    "STRIPE_PRICE_BUSINESS",
    stripePriceEnvUsd: "STRIPE_PRICE_BUSINESS_USD",
  },
  SCALE: {
    monthlyJpy:         98000,
    monthlyUsd:         699,
    freeCallsPerMonth:  500000,
    features: {
      accountingIntegration: true,
      invoiceGeneration:     true,
      jpyOfframp:            true,
      multiWallet:           true,
      sla999:                true,
    },
    stripePriceEnv:    "STRIPE_PRICE_SCALE",
    stripePriceEnvUsd: "STRIPE_PRICE_SCALE_USD",
  },
  ENTERPRISE: {
    monthlyJpy:         0,
    monthlyUsd:         0,
    freeCallsPerMonth:  Number.MAX_SAFE_INTEGER,
    features: {
      accountingIntegration: true,
      invoiceGeneration:     true,
      jpyOfframp:            true,
      multiWallet:           true,
      sla999:                true,
    },
    stripePriceEnv:    null,
    stripePriceEnvUsd: null,
  },
};

/**
 * Provider のプラン設定を取得（subscription が無ければ FREE）。
 */
export function resolvePlanFromName(plan: SubscriptionPlan | null | undefined): PlanConfig {
  if (!plan) return PLAN_CONFIG.FREE;
  return PLAN_CONFIG[plan] ?? PLAN_CONFIG.FREE;
}

/**
 * 指定通貨での Stripe Price ID を解決。
 * USD price が未設定なら JPY price にフォールバック（移行期）。
 */
export function stripePriceIdFor(plan: SubscriptionPlan, currency: Currency = "jpy"): string | null {
  const cfg = PLAN_CONFIG[plan];
  if (!cfg) return null;
  const envKey = currency === "usd"
    ? cfg.stripePriceEnvUsd
    : cfg.stripePriceEnv;
  if (!envKey) return null;
  return process.env[envKey] ?? null;
}
