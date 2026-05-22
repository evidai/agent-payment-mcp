/**
 * サブスクリプションプラン定義 — single source of truth.
 *
 * 設計（v2 確定版）:
 *   - per-call の単価は **Provider が /sellers で設定した値** が真。
 *     LemonCake はこの値を override しない（per-call は 100% Provider へ）。
 *   - プランは「月間無料枠 (freeCallsPerMonth)」と「機能フラグ」だけを決める。
 *     無料枠は LemonCake が補填する（buyer は払わない、provider は受け取らない）。
 *   - 収益は月額サブスクのみ（Stripe で JPY 課金）。
 *
 * ※ 旧 overagePerCallUsdc は廃止。Provider が pricePerCallUsdc を自分で
 *    決める仕様と矛盾していたため。
 */

import type { SubscriptionPlan } from "@prisma/client";

export interface PlanConfig {
  /** 月額（JPY） */
  monthlyJpy:        number;
  /** 月間無料 call 数（LemonCake 負担。超過は Provider 設定単価で課金） */
  freeCallsPerMonth: number;
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
    monthlyJpy:         9800,
    freeCallsPerMonth:  10000,
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
    monthlyJpy:         29800,
    freeCallsPerMonth:  100000,
    features: {
      accountingIntegration: true,
      invoiceGeneration:     true,
      jpyOfframp:            true,
      multiWallet:           true,
      sla999:                true,
    },
    stripePriceEnv:    "STRIPE_PRICE_BUSINESS",
  },
  SCALE: {
    monthlyJpy:         98000,
    freeCallsPerMonth:  500000,
    features: {
      accountingIntegration: true,
      invoiceGeneration:     true,
      jpyOfframp:            true,
      multiWallet:           true,
      sla999:                true,
    },
    stripePriceEnv:    "STRIPE_PRICE_SCALE",
  },
  ENTERPRISE: {
    monthlyJpy:         0,  // 個別見積もり
    freeCallsPerMonth:  Number.MAX_SAFE_INTEGER,
    features: {
      accountingIntegration: true,
      invoiceGeneration:     true,
      jpyOfframp:            true,
      multiWallet:           true,
      sla999:                true,
    },
    stripePriceEnv:    null,
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
