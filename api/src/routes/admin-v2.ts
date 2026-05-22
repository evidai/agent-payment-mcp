/**
 * /api/admin/v2 — v2 専用の管理画面向け read-only エンドポイント群
 *
 * 既存の /api/admin はカスタディ時代の KPI（buyer balance / charge total）を
 * 集計するが、v2 では：
 *   - Subscription MRR（Stripe 経由のサブスク売上）
 *   - PermitCharge 集計（permit ベース on-chain 課金）
 *   - ProviderV2 一覧（permit 受け取り側）
 *   - Invoice / OfframpTransaction の運営側ダッシュボード
 * を見たいので、独立して提供する。
 *
 * 認証は既存 /api/admin と同様の admin JWT（middleware/buyerAuth.ts の
 * verifyAdminToken 系）を後付けする想定。v0 は open（dev 段階）。
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { prisma } from "../lib/prisma.js";
import { PLAN_CONFIG } from "../lib/plans.js";
import { Decimal } from "@prisma/client/runtime/library";

export const adminV2Router = new OpenAPIHono();

// ─── GET /api/admin/v2/stats ────────────────────────────────────
// Overview KPI: MRR / volume / provider count / charges today

adminV2Router.openapi(
  createRoute({
    method: "get",
    path:   "/stats",
    tags:   ["AdminV2"],
    summary: "v2 ダッシュボードの集計 KPI",
    responses: {
      200: { content: { "application/json": { schema: z.object({
        mrrJpy:                z.number(),
        annualizedArrJpy:      z.number(),
        activeSubscriptions: z.object({
          PRO:        z.number(),
          BUSINESS:   z.number(),
          ENTERPRISE: z.number(),
          FREE:       z.number(),
        }),
        providers: z.object({
          total:  z.number(),
          active: z.number(),
          suspended: z.number(),
        }),
        charges: z.object({
          todayCount:       z.number(),
          todayVolumeUsdc:  z.string(),
          monthCount:       z.number(),
          monthVolumeUsdc:  z.string(),
          allTimeCount:     z.number(),
          allTimeVolumeUsdc:z.string(),
        }),
        invoices: z.object({
          draft:  z.number(),
          issued: z.number(),
          sent:   z.number(),
        }),
        offramp: z.object({
          pending: z.number(),
          completed: z.number(),
          failed: z.number(),
        }),
      }) } }, description: "Stats" },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Subscription 集計（status=ACTIVE のみ MRR にカウント）
    const subs = await prisma.subscription.groupBy({
      by: ["plan", "status"],
      _count: { _all: true },
    });

    const activeSubsByPlan: Record<"PRO" | "BUSINESS" | "ENTERPRISE" | "FREE", number> = {
      PRO: 0, BUSINESS: 0, ENTERPRISE: 0, FREE: 0,
    };
    let mrrJpy = 0;
    for (const s of subs) {
      if (s.status !== "ACTIVE") continue;
      activeSubsByPlan[s.plan as keyof typeof activeSubsByPlan] += s._count._all;
      const cfg = PLAN_CONFIG[s.plan];
      mrrJpy += (cfg?.monthlyJpy ?? 0) * s._count._all;
    }

    // ProviderV2 集計
    const providerCounts = await prisma.providerV2.groupBy({
      by: ["active"],
      _count: { _all: true },
    });
    const providers = providerCounts.reduce((acc, r) => {
      const n = r._count._all;
      acc.total += n;
      if (r.active) acc.active += n;
      else acc.suspended += n;
      return acc;
    }, { total: 0, active: 0, suspended: 0 });

    // PermitCharge 集計
    async function chargesSince(since?: Date) {
      const where = { status: "COMPLETED" as const, ...(since ? { createdAt: { gte: since } } : {}) };
      const charges = await prisma.permitCharge.findMany({ where, select: { amountUsdc: true } });
      const volume = charges.reduce((sum, c) => sum.add(c.amountUsdc), new Decimal(0));
      return { count: charges.length, volume: volume.toString() };
    }
    const [todayC, monthC, allC] = await Promise.all([
      chargesSince(todayStart),
      chargesSince(monthStart),
      chargesSince(),
    ]);

    // Invoice 集計
    const invoiceCounts = await prisma.invoice.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const invoices = { draft: 0, issued: 0, sent: 0 };
    for (const r of invoiceCounts) {
      if (r.status === "DRAFT")  invoices.draft += r._count._all;
      if (r.status === "ISSUED") invoices.issued += r._count._all;
      if (r.status === "SENT" || r.status === "PAID") invoices.sent += r._count._all;
    }

    // Offramp 集計
    const offrampCounts = await prisma.offrampTransaction.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const offramp = { pending: 0, completed: 0, failed: 0 };
    for (const r of offrampCounts) {
      if (r.status === "PENDING" || r.status === "USDC_SENT" || r.status === "SOLD") offramp.pending += r._count._all;
      if (r.status === "WITHDRAWN") offramp.completed += r._count._all;
      if (r.status === "FAILED")    offramp.failed    += r._count._all;
    }

    return c.json({
      mrrJpy,
      annualizedArrJpy: mrrJpy * 12,
      activeSubscriptions: activeSubsByPlan,
      providers,
      charges: {
        todayCount:        todayC.count,
        todayVolumeUsdc:   todayC.volume,
        monthCount:        monthC.count,
        monthVolumeUsdc:   monthC.volume,
        allTimeCount:      allC.count,
        allTimeVolumeUsdc: allC.volume,
      },
      invoices,
      offramp,
    });
  },
);

// ─── GET /api/admin/v2/providers ────────────────────────────────

adminV2Router.openapi(
  createRoute({
    method: "get",
    path:   "/providers",
    tags:   ["AdminV2"],
    summary: "ProviderV2 一覧（subscription/active を含む）",
    request: { query: z.object({ limit: z.coerce.number().int().min(1).max(200).default(100) }) },
    responses: {
      200: { content: { "application/json": { schema: z.array(z.object({
        id:                 z.string(),
        name:               z.string(),
        email:              z.string(),
        baseWalletAddress:  z.string(),
        pricePerCallUsdc:   z.string(),
        freeCallsPerMonth:  z.number(),
        registrationNumber: z.string().nullable(),
        autoIssueInvoices:  z.boolean(),
        active:             z.boolean(),
        plan:               z.enum(["FREE","PRO","BUSINESS","ENTERPRISE"]),
        subscriptionStatus: z.string(),
        createdAt:          z.string(),
      })) } }, description: "Providers" },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const { limit } = c.req.valid("query");
    const rows = await prisma.providerV2.findMany({
      include: { subscription: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return c.json(rows.map(p => ({
      id:                 p.id,
      name:               p.name,
      email:              p.email,
      baseWalletAddress:  p.baseWalletAddress,
      pricePerCallUsdc:   p.pricePerCallUsdc.toString(),
      freeCallsPerMonth:  p.freeCallsPerMonth,
      registrationNumber: p.registrationNumber,
      autoIssueInvoices:  p.autoIssueInvoices,
      active:             p.active,
      plan:               (p.subscription?.status === "ACTIVE" ? p.subscription.plan : "FREE") as "FREE"|"PRO"|"BUSINESS"|"ENTERPRISE",
      subscriptionStatus: p.subscription?.status ?? "NONE",
      createdAt:          p.createdAt.toISOString(),
    })));
  },
);

// ─── GET /api/admin/v2/charges ──────────────────────────────────

adminV2Router.openapi(
  createRoute({
    method: "get",
    path:   "/charges",
    tags:   ["AdminV2"],
    summary: "PermitCharge 履歴（全 provider 横断）",
    request: { query: z.object({
      limit:  z.coerce.number().int().min(1).max(500).default(100),
      status: z.enum(["PENDING","COMPLETED","FAILED"]).optional(),
    }) },
    responses: {
      200: { content: { "application/json": { schema: z.array(z.object({
        id:            z.string(),
        ownerAddress:  z.string(),
        serviceId:     z.string(),
        providerName:  z.string().nullable(),
        amountUsdc:    z.string(),
        txHash:        z.string().nullable(),
        status:        z.string(),
        failureReason: z.string().nullable(),
        createdAt:     z.string(),
        completedAt:   z.string().nullable(),
      })) } }, description: "Charges" },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const q = c.req.valid("query");
    const rows = await prisma.permitCharge.findMany({
      where: q.status ? { status: q.status } : undefined,
      orderBy: { createdAt: "desc" },
      take: q.limit,
    });
    // 各 serviceId に対応する provider 名を一括取得
    const providerIds = Array.from(new Set(rows.map(r => r.serviceId)));
    const providers = await prisma.providerV2.findMany({
      where: { id: { in: providerIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(providers.map(p => [p.id, p.name]));

    return c.json(rows.map(r => ({
      id:            r.id,
      ownerAddress:  r.ownerAddress,
      serviceId:     r.serviceId,
      providerName:  nameMap.get(r.serviceId) ?? null,
      amountUsdc:    r.amountUsdc.toString(),
      txHash:        r.txHash,
      status:        r.status,
      failureReason: r.failureReason,
      createdAt:     r.createdAt.toISOString(),
      completedAt:   r.completedAt?.toISOString() ?? null,
    })));
  },
);

// ─── GET /api/admin/v2/invoices ─────────────────────────────────

adminV2Router.openapi(
  createRoute({
    method: "get",
    path:   "/invoices",
    tags:   ["AdminV2"],
    summary: "Invoice 一覧（全 provider 横断）",
    request: { query: z.object({ limit: z.coerce.number().int().min(1).max(200).default(100) }) },
    responses: {
      200: { content: { "application/json": { schema: z.array(z.object({
        id:           z.string(),
        providerName: z.string().nullable(),
        buyerAddress: z.string(),
        callCount:    z.number(),
        totalJpy:     z.string(),
        totalUsdc:    z.string(),
        status:       z.string(),
        periodFrom:   z.string(),
        periodTo:     z.string(),
        issuedAt:     z.string(),
      })) } }, description: "Invoices" },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const { limit } = c.req.valid("query");
    const rows = await prisma.invoice.findMany({
      include: { providerV2: { select: { name: true } } },
      orderBy: { issuedAt: "desc" },
      take: limit,
    });
    return c.json(rows.map(r => ({
      id:           r.id,
      providerName: r.providerV2?.name ?? null,
      buyerAddress: r.buyerAddress,
      callCount:    r.callCount,
      totalJpy:     r.totalJpy.toString(),
      totalUsdc:    r.totalUsdc.toString(),
      status:       r.status,
      periodFrom:   r.periodFrom.toISOString(),
      periodTo:     r.periodTo.toISOString(),
      issuedAt:     r.issuedAt.toISOString(),
    })));
  },
);

// ─── GET /api/admin/v2/offramp ──────────────────────────────────

adminV2Router.openapi(
  createRoute({
    method: "get",
    path:   "/offramp",
    tags:   ["AdminV2"],
    summary: "OfframpTransaction 一覧",
    request: { query: z.object({ limit: z.coerce.number().int().min(1).max(200).default(100) }) },
    responses: {
      200: { content: { "application/json": { schema: z.array(z.object({
        id:             z.string(),
        providerName:   z.string().nullable(),
        exchange:       z.string(),
        usdcAmount:     z.string(),
        withdrawnJpy:   z.string().nullable(),
        status:         z.string(),
        failureReason:  z.string().nullable(),
        createdAt:      z.string(),
      })) } }, description: "Offramp transactions" },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const { limit } = c.req.valid("query");
    const rows = await prisma.offrampTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    const providerIds = Array.from(new Set(rows.map(r => r.providerV2Id)));
    const providers = await prisma.providerV2.findMany({
      where: { id: { in: providerIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(providers.map(p => [p.id, p.name]));

    return c.json(rows.map(r => ({
      id:            r.id,
      providerName:  nameMap.get(r.providerV2Id) ?? null,
      exchange:      r.exchange,
      usdcAmount:    r.usdcAmount.toString(),
      withdrawnJpy:  r.withdrawnJpy?.toString() ?? null,
      status:        r.status,
      failureReason: r.failureReason,
      createdAt:     r.createdAt.toISOString(),
    })));
  },
);
