/**
 * /api/subscriptions — Stripe Billing 連携
 *
 *   POST /api/subscriptions/checkout      — Checkout Session 発行 → Stripe URL 返却
 *   POST /api/subscriptions/portal        — Customer Portal セッション発行
 *   POST /api/subscriptions/webhook       — Stripe Webhook（invoice.paid 等）
 *   GET  /api/subscriptions/me            — provider 自身の subscription 状態
 *
 *   v0 は Provider ID を query/body で受け取る簡易認証。本番は providerV2.apiKey
 *   で署名検証してから操作する形に置き換える。
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { Hono } from "hono";
// Stripe v22 type-namespace は互換用に require して default を取り出す（既存 stripe-bank.ts と同じパターン）
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Stripe = require("stripe").default ?? require("stripe");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StripeClient = any;
import { prisma } from "../lib/prisma.js";
import { stripePriceIdFor, PLAN_CONFIG } from "../lib/plans.js";

export const subscriptionsRouter = new OpenAPIHono();
// Stripe Webhook は zod 検証なしで raw body を扱うので独立した Hono インスタンス
export const subscriptionsWebhookRouter = new Hono();

function getStripeClient(): StripeClient {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
}

const FRONTEND_URL = process.env.FRONTEND_URL ?? "https://lemoncake.xyz";

// ─── POST /api/subscriptions/checkout ─────────────────────────

const CheckoutBody = z.object({
  providerV2Id: z.string().min(1),
  plan:         z.enum(["PRO", "BUSINESS"]),  // FREE は checkout 不要、Enterprise は手動
  successUrl:   z.string().url().optional(),
  cancelUrl:    z.string().url().optional(),
});

subscriptionsRouter.openapi(
  createRoute({
    method:  "post",
    path:    "/checkout",
    tags:    ["Subscriptions"],
    summary: "Stripe Checkout Session を発行",
    request: { body: { content: { "application/json": { schema: CheckoutBody } }, required: true } },
    responses: {
      200: { content: { "application/json": { schema: z.object({ url: z.string() }) } }, description: "Checkout URL" },
      400: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Bad Request" },
      404: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Not found" },
      503: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Stripe not configured" },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const body = c.req.valid("json");

    const provider = await prisma.providerV2.findUnique({
      where: { id: body.providerV2Id },
      include: { subscription: true },
    });
    if (!provider) return c.json({ error: "Provider not found" }, 404);

    const priceId = stripePriceIdFor(body.plan);
    if (!priceId) {
      return c.json({ error: `Stripe price ID not configured for plan ${body.plan}` }, 503);
    }

    let stripe: StripeClient;
    try { stripe = getStripeClient(); }
    catch { return c.json({ error: "Stripe is not configured" }, 503); }

    // 既存 Customer があれば再利用
    let customerId = provider.subscription?.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: provider.email,
        name:  provider.name,
        metadata: { providerV2Id: provider.id },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode:          "subscription",
      customer:      customerId,
      line_items:    [{ price: priceId, quantity: 1 }],
      success_url:   (body.successUrl ?? `${FRONTEND_URL}/?subscription=success`) + "&session_id={CHECKOUT_SESSION_ID}",
      cancel_url:    body.cancelUrl  ?? `${FRONTEND_URL}/?subscription=cancel`,
      metadata: {
        providerV2Id: provider.id,
        plan:         body.plan,
      },
      subscription_data: {
        metadata: {
          providerV2Id: provider.id,
          plan:         body.plan,
        },
      },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return c.json({ error: "Stripe did not return a checkout URL" }, 503);
    }
    return c.json({ url: session.url });
  },
);

// ─── POST /api/subscriptions/portal ─────────────────────────────

subscriptionsRouter.openapi(
  createRoute({
    method:  "post",
    path:    "/portal",
    tags:    ["Subscriptions"],
    summary: "Stripe Customer Portal セッション発行（解約・カード変更）",
    request: {
      body: {
        content: { "application/json": { schema: z.object({
          providerV2Id: z.string().min(1),
          returnUrl:    z.string().url().optional(),
        }) } },
        required: true,
      },
    },
    responses: {
      200: { content: { "application/json": { schema: z.object({ url: z.string() }) } }, description: "Portal URL" },
      400: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Bad Request" },
      404: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Not found" },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const { providerV2Id, returnUrl } = c.req.valid("json");
    const sub = await prisma.subscription.findUnique({ where: { providerV2Id } });
    if (!sub?.stripeCustomerId) {
      return c.json({ error: "No Stripe customer for this provider" }, 404);
    }
    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer:   sub.stripeCustomerId,
      return_url: returnUrl ?? `${FRONTEND_URL}/`,
    });
    return c.json({ url: session.url });
  },
);

// ─── GET /api/subscriptions/me?providerV2Id=… ───────────────────

subscriptionsRouter.openapi(
  createRoute({
    method:  "get",
    path:    "/me",
    tags:    ["Subscriptions"],
    summary: "Provider 自身の subscription 状態",
    request: { query: z.object({ providerV2Id: z.string().min(1) }) },
    responses: {
      200: {
        content: { "application/json": { schema: z.object({
          plan:               z.enum(["FREE","PRO","BUSINESS","ENTERPRISE"]),
          status:             z.string(),
          freeCallsPerMonth:  z.number(),
          overagePerCallUsdc: z.string(),
          monthlyJpy:         z.number(),
          features: z.object({
            accountingIntegration: z.boolean(),
            invoiceGeneration:     z.boolean(),
            jpyOfframp:            z.boolean(),
            multiWallet:           z.boolean(),
            sla999:                z.boolean(),
          }),
          currentPeriodEnd:   z.string().nullable(),
          cancelAtPeriodEnd:  z.boolean(),
        }) } },
        description: "Subscription state",
      },
      404: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Not found" },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const { providerV2Id } = c.req.valid("query");
    const provider = await prisma.providerV2.findUnique({
      where: { id: providerV2Id },
      include: { subscription: true },
    });
    if (!provider) return c.json({ error: "Provider not found" }, 404);

    const sub = provider.subscription;
    const plan = (sub?.status === "ACTIVE" ? sub.plan : "FREE") as "FREE" | "PRO" | "BUSINESS" | "ENTERPRISE";
    const cfg = PLAN_CONFIG[plan];

    return c.json({
      plan,
      status:             sub?.status ?? "ACTIVE",
      freeCallsPerMonth:  cfg.freeCallsPerMonth,
      overagePerCallUsdc: cfg.overagePerCallUsdc,
      monthlyJpy:         cfg.monthlyJpy,
      features:           cfg.features,
      currentPeriodEnd:   sub?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd:  sub?.cancelAtPeriodEnd ?? false,
    });
  },
);

// ─── POST /api/subscriptions/webhook (raw body) ─────────────────
// Stripe Webhook 署名検証 → subscription.created / updated / deleted
// に応じて Subscription レコードを upsert。

subscriptionsWebhookRouter.post("/", async (c) => {
  const secret = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET;
  if (!secret) return c.json({ error: "Webhook secret not configured" }, 503);

  const signature = c.req.header("stripe-signature");
  if (!signature) return c.json({ error: "Missing stripe-signature" }, 400);

  const rawBody = await c.req.text();
  const stripe = getStripeClient();

  let event: any;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (e) {
    console.error("[subscriptions webhook] sig verify failed:", e);
    return c.json({ error: "Invalid signature" }, 400);
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncSubscriptionFromStripe(stripe, event);
      break;
    }
    default:
      // 他のイベントは無視
      break;
  }

  return c.json({ received: true });
});

async function syncSubscriptionFromStripe(stripe: StripeClient, event: any): Promise<void> {
  let stripeSubId: string | null = null;
  let customerId:  string | null = null;
  let providerV2Id: string | null = null;
  let planFromMetadata: string | null = null;

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    stripeSubId      = (session.subscription as string) ?? null;
    customerId       = (session.customer     as string) ?? null;
    providerV2Id     = session.metadata?.providerV2Id ?? null;
    planFromMetadata = session.metadata?.plan ?? null;
  } else {
    const sub = event.data.object as any;
    stripeSubId      = sub.id;
    customerId       = sub.customer as string;
    providerV2Id     = sub.metadata?.providerV2Id ?? null;
    planFromMetadata = sub.metadata?.plan ?? null;
  }

  if (!providerV2Id || !customerId) return;

  // Stripe から最新の subscription を取って状態反映
  let stripeSub: any | null = null;
  if (stripeSubId) {
    try { stripeSub = await stripe.subscriptions.retrieve(stripeSubId); }
    catch { /* deleted 等 */ }
  }

  const plan = (planFromMetadata ?? "FREE") as "FREE"|"PRO"|"BUSINESS"|"ENTERPRISE";
  const status = mapStripeStatus(stripeSub?.status, event.type);

  const periodStart = stripeSub?.current_period_start
    ? new Date(stripeSub.current_period_start * 1000)
    : null;
  const periodEnd = stripeSub?.current_period_end
    ? new Date(stripeSub.current_period_end * 1000)
    : null;

  await prisma.subscription.upsert({
    where:  { providerV2Id },
    update: {
      plan,
      status,
      stripeCustomerId:     customerId,
      stripeSubscriptionId: stripeSubId,
      stripePriceId:        stripeSub?.items?.data?.[0]?.price?.id ?? null,
      currentPeriodStart:   periodStart,
      currentPeriodEnd:     periodEnd,
      cancelAtPeriodEnd:    stripeSub?.cancel_at_period_end ?? false,
    },
    create: {
      providerV2Id,
      plan,
      status,
      stripeCustomerId:     customerId,
      stripeSubscriptionId: stripeSubId,
      stripePriceId:        stripeSub?.items?.data?.[0]?.price?.id ?? null,
      currentPeriodStart:   periodStart,
      currentPeriodEnd:     periodEnd,
      cancelAtPeriodEnd:    stripeSub?.cancel_at_period_end ?? false,
    },
  });
}

function mapStripeStatus(stripeStatus: string | undefined, eventType: string): "ACTIVE" | "PAST_DUE" | "CANCELED" | "TRIALING" | "INCOMPLETE" {
  if (eventType === "customer.subscription.deleted") return "CANCELED";
  switch (stripeStatus) {
    case "active":      return "ACTIVE";
    case "past_due":    return "PAST_DUE";
    case "canceled":    return "CANCELED";
    case "trialing":    return "TRIALING";
    case "incomplete":  return "INCOMPLETE";
    case "incomplete_expired": return "CANCELED";
    case "unpaid":      return "PAST_DUE";
    default:            return "ACTIVE";
  }
}
