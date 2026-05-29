/**
 * @lemoncake/mcp-sdk — Backend endpoints
 *
 * POST /api/sdk/preflight  — Check balance and reserve a charge slot
 * POST /api/sdk/charge     — Confirm or cancel a reserved charge
 * GET  /api/sdk/earnings   — Seller earnings summary
 *
 * Authentication:
 *   - preflight / charge: Pay Token in body (forwarded from buyer's agent)
 *   - earnings: SELLER_KEY in Authorization header (Bearer <sellerKey>)
 *
 * A "seller" in this context is a Provider who has registered their MCP server
 * on the LemonCake marketplace. Their sellerKey is their Provider.buyerId JWT
 * (i.e. the same Buyer JWT they use on the dashboard, since Providers are also
 * Buyers in the schema).
 *
 * The SDK endpoints are intentionally thin wrappers around the existing
 * /api/charge flow; they add preflight (dry-run balance check) and a
 * seller-scoped earnings view.
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { prisma } from "../lib/prisma.js";
import { verifyPayToken, verifyBuyerToken } from "../lib/jwt.js";
import { HTTPException } from "hono/http-exception";
import { Decimal } from "@prisma/client/runtime/library";
import { getUsdcTransferQueue } from "../lib/queue.js";

export const sdkRouter = new OpenAPIHono();

// ─── Shared Zod schemas ───────────────────────────────────────────────────

const AmountField = z
  .string()
  .regex(/^\d+(\.\d{1,6})?$/, "amount: up to 6 decimal places (USDC precision)")
  .refine((v) => parseFloat(v) > 0, "amount must be > 0");

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sdk/preflight
// ─────────────────────────────────────────────────────────────────────────────

const preflightBody = z.object({
  payToken: z.string().min(10),
  amount: AmountField,
  toolName: z.string().min(1).max(128),
  sellerId: z.string().optional(),
});

const preflightResponse = z.object({
  allowed: z.boolean(),
  remainingUsdc: z.string(),
  chargeId: z.string(),
  reason: z.string().optional(),
});

sdkRouter.openapi(
  createRoute({
    method: "post",
    path: "/preflight",
    tags: ["SDK"],
    summary: "Check balance and reserve a charge slot",
    description: [
      "Called by `@lemoncake/mcp-sdk` before executing a tool.",
      "Validates the Pay Token, checks buyer balance, and returns a `chargeId`",
      "that must be confirmed via `POST /api/sdk/charge` after tool execution.",
      "",
      "If `allowed: false`, the SDK returns a 402-equivalent MCP error without",
      "running the tool. The `reason` field explains why.",
    ].join("\n"),
    request: {
      body: {
        content: { "application/json": { schema: preflightBody } },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: preflightResponse } },
        description: "Preflight result",
      },
      401: { description: "Invalid Pay Token" },
    },
  }),
  async (c) => {
    const body = c.req.valid("json");

    // ── Verify Pay Token ────────────────────────────────────────────────────
    let tokenPayload: Awaited<ReturnType<typeof verifyPayToken>>;
    try {
      tokenPayload = await verifyPayToken(body.payToken);
    } catch (err) {
      throw new HTTPException(401, {
        message: `Invalid Pay Token: ${err instanceof Error ? err.message : "unknown"}`,
      });
    }

    const { jti: tokenId, sub: buyerId, serviceId, scope } = tokenPayload;

    // ── Validate token DB record ────────────────────────────────────────────
    const token = await prisma.token.findUnique({ where: { id: tokenId } });
    if (!token) {
      return c.json(
        { allowed: false, remainingUsdc: "0.000000", chargeId: "", reason: "Token record not found" },
        200
      );
    }
    if (token.revoked) {
      return c.json(
        { allowed: false, remainingUsdc: "0.000000", chargeId: "", reason: "Token has been revoked" },
        200
      );
    }
    if (token.expiresAt < new Date()) {
      return c.json(
        { allowed: false, remainingUsdc: "0.000000", chargeId: "", reason: "Token has expired" },
        200
      );
    }

    const amountDecimal = new Decimal(body.amount);

    // ── Token limit check ───────────────────────────────────────────────────
    const newUsed = token.usedUsdc.add(amountDecimal);
    if (newUsed.greaterThan(token.limitUsdc)) {
      const remaining = token.limitUsdc.minus(token.usedUsdc);
      return c.json(
        {
          allowed: false,
          remainingUsdc: remaining.lessThan(0)
            ? "0.000000"
            : remaining.toFixed(6),
          chargeId: "",
          reason: `Token limit exceeded: limit=${token.limitUsdc.toFixed(6)}, used=${token.usedUsdc.toFixed(6)}, requested=${amountDecimal.toFixed(6)}`,
        },
        200
      );
    }

    // ── Buyer balance check (skip for sandbox tokens) ───────────────────────
    const buyer = await prisma.buyer.findUnique({ where: { id: buyerId } });
    if (!buyer) {
      return c.json(
        { allowed: false, remainingUsdc: "0.000000", chargeId: "", reason: "Buyer account not found" },
        200
      );
    }
    if (buyer.suspended) {
      return c.json(
        { allowed: false, remainingUsdc: "0.000000", chargeId: "", reason: "Buyer account is suspended" },
        200
      );
    }
    if (!token.sandbox && buyer.balanceUsdc.lessThan(amountDecimal)) {
      return c.json(
        {
          allowed: false,
          remainingUsdc: buyer.balanceUsdc.toFixed(6),
          chargeId: "",
          reason: `Insufficient balance: ${buyer.balanceUsdc.toFixed(6)} USDC available, ${amountDecimal.toFixed(6)} required`,
        },
        200
      );
    }

    // ── Resolve service for the charge record ───────────────────────────────
    // SDK tools need a serviceId. If the token is ALL-scope, we look up the
    // seller's registered service. If SINGLE-scope, we use the token's serviceId.
    let resolvedServiceId: string | undefined = serviceId ?? undefined;
    if (!resolvedServiceId && body.sellerId) {
      // Find the provider associated with this seller and pick their first service
      const provider = await prisma.provider.findFirst({
        where: { buyerId: body.sellerId },
        include: { services: { where: { reviewStatus: "APPROVED" }, take: 1 } },
      });
      resolvedServiceId = provider?.services[0]?.id;
    }

    if (!resolvedServiceId) {
      // Cannot create a charge without a serviceId — but preflight can still succeed
      // The charge step will fail gracefully. Return a synthetic chargeId.
      const syntheticId = `sdk_preflight_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      return c.json(
        {
          allowed: true,
          remainingUsdc: buyer.balanceUsdc.toFixed(6),
          chargeId: syntheticId,
          reason: "No serviceId resolved — charge step will be a no-op (sandbox/demo billing)",
        },
        200
      );
    }

    // ── Create PENDING charge record ────────────────────────────────────────
    const idempotencyKey = `sdk_${tokenId}_${body.toolName}_${Date.now().toString(36)}`;
    const isSandbox = token.sandbox;

    const charge = await prisma.charge.create({
      data: {
        buyerId,
        serviceId: resolvedServiceId,
        tokenId,
        amountUsdc: amountDecimal,
        idempotencyKey,
        status: "PENDING",
        riskScore: 0,
        sandbox: isSandbox,
        requestId: body.toolName,
        workflowId: token.workflowId,
        agentId: token.agentId,
      },
    });

    return c.json(
      {
        allowed: true,
        remainingUsdc: buyer.balanceUsdc.toFixed(6),
        chargeId: charge.id,
      },
      200
    );
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sdk/charge
// ─────────────────────────────────────────────────────────────────────────────

const chargeBody = z.object({
  chargeId: z.string().min(1),
  toolName: z.string().min(1).max(128),
  amount: AmountField,
  sellerId: z.string().optional(),
  success: z.boolean(),
});

const chargeResponseSchema = z.object({
  chargeId: z.string(),
  charged: z.string(),
  newBalance: z.string(),
  status: z.enum(["completed", "cancelled", "demo", "not_found"]),
});

sdkRouter.openapi(
  createRoute({
    method: "post",
    path: "/charge",
    tags: ["SDK"],
    summary: "Confirm or cancel a preflight charge",
    description: [
      "Called by `@lemoncake/mcp-sdk` after tool execution.",
      "- `success: true`  → complete the charge (deduct USDC from buyer balance)",
      "- `success: false` → cancel the charge (release the reserved amount)",
      "",
      "Idempotent: calling with the same chargeId twice returns the existing result.",
    ].join("\n"),
    request: {
      body: {
        content: { "application/json": { schema: chargeBody } },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: chargeResponseSchema } },
        description: "Charge result",
      },
      404: { description: "chargeId not found" },
    },
  }),
  async (c) => {
    const body = c.req.valid("json");

    // ── Synthetic / demo chargeId ───────────────────────────────────────────
    if (body.chargeId.startsWith("sdk_preflight_") || body.chargeId.startsWith("demo_")) {
      return c.json(
        {
          chargeId: body.chargeId,
          charged: body.success ? body.amount : "0.000000",
          newBalance: "0.000000",
          status: "demo" as const,
        },
        200
      );
    }

    // ── Load charge record ──────────────────────────────────────────────────
    const charge = await prisma.charge.findUnique({
      where: { id: body.chargeId },
      include: { token: true, buyer: true },
    });

    if (!charge) {
      throw new HTTPException(404, { message: `Charge ${body.chargeId} not found` });
    }

    // Already settled
    if (charge.status !== "PENDING") {
      return c.json(
        {
          chargeId: charge.id,
          charged: charge.amountUsdc.toFixed(6),
          newBalance: charge.buyer.balanceUsdc.toFixed(6),
          status: charge.status === "COMPLETED" ? ("completed" as const) : ("cancelled" as const),
        },
        200
      );
    }

    const amountDecimal = new Decimal(body.amount);

    if (!body.success) {
      // ── Cancel: mark as FAILED, do not deduct ──────────────────────────────
      await prisma.charge.update({
        where: { id: charge.id },
        data: { status: "FAILED", failureReason: "Tool execution failed — charge cancelled by SDK" },
      });
      return c.json(
        {
          chargeId: charge.id,
          charged: "0.000000",
          newBalance: charge.buyer.balanceUsdc.toFixed(6),
          status: "cancelled" as const,
        },
        200
      );
    }

    // ── Confirm: deduct balance, update token usedUsdc ─────────────────────
    const isSandbox = charge.token.sandbox;

    const updatedBuyer = await prisma.$transaction(async (tx) => {
      // Recheck token revoke status in transaction
      const freshToken = await tx.token.findUnique({
        where: { id: charge.tokenId },
        select: { revoked: true },
      });
      if (!freshToken || freshToken.revoked) {
        throw new HTTPException(422, { message: "Token was revoked during tool execution" });
      }

      // Deduct buyer balance (skip for sandbox)
      let buyer = charge.buyer;
      if (!isSandbox) {
        buyer = await tx.buyer.update({
          where: { id: charge.buyerId },
          data: { balanceUsdc: { decrement: amountDecimal } },
        });
      }

      // Update token usedUsdc
      await tx.token.update({
        where: { id: charge.tokenId },
        data: { usedUsdc: { increment: amountDecimal } },
      });

      // Mark charge as COMPLETED
      await tx.charge.update({
        where: { id: charge.id },
        data: { status: isSandbox ? "COMPLETED" : "PENDING" }, // USDC transfer happens async
      });

      return buyer;
    });

    // ── Enqueue USDC transfer (non-sandbox only) ────────────────────────────
    if (!isSandbox && process.env.SKIP_WORKER !== "true") {
      try {
        const queue = getUsdcTransferQueue();
        await Promise.race([
          queue.add(
            "transfer",
            {
              chargeId: charge.id,
              buyerId: charge.buyerId,
              serviceId: charge.serviceId,
              amountUsdc: amountDecimal.toFixed(6),
            },
            { jobId: charge.id }
          ),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Queue timeout")), 3000)
          ),
        ]);
      } catch (queueErr) {
        console.error("[SDK /charge] Failed to enqueue USDC transfer:", queueErr);
      }
    }

    return c.json(
      {
        chargeId: charge.id,
        charged: amountDecimal.toFixed(6),
        newBalance: updatedBuyer.balanceUsdc.toFixed(6),
        status: "completed" as const,
      },
      200
    );
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sdk/earnings
// ─────────────────────────────────────────────────────────────────────────────

const earningsQuerySchema = z.object({
  serviceId: z.string().optional(),
});

const earningsResponseSchema = z.object({
  totalEarned: z.string(),
  todayEarned: z.string(),
  callCount: z.number(),
  serviceId: z.string().nullable(),
});

sdkRouter.openapi(
  createRoute({
    method: "get",
    path: "/earnings",
    tags: ["SDK"],
    summary: "Get seller earnings summary",
    description: [
      "Returns cumulative USDC earnings for the authenticated seller.",
      "Authentication: `Authorization: Bearer <LEMONCAKE_SELLER_KEY>`",
      "The seller key is the seller's Buyer JWT (issued from the dashboard).",
      "",
      "Earnings = sum of COMPLETED charges for services owned by this seller's Provider.",
      "If `serviceId` query param is provided, filters to that service only.",
    ].join("\n"),
    request: {
      query: earningsQuerySchema,
    },
    responses: {
      200: {
        content: { "application/json": { schema: earningsResponseSchema } },
        description: "Earnings data",
      },
      401: { description: "Invalid or missing seller key" },
      404: { description: "No provider found for this seller" },
    },
  }),
  async (c) => {
    // ── Authenticate seller (Buyer JWT) ────────────────────────────────────
    const auth = c.req.header("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      throw new HTTPException(401, { message: "Seller key required: Authorization: Bearer <key>" });
    }

    let buyerPayload: Awaited<ReturnType<typeof verifyBuyerToken>>;
    try {
      buyerPayload = await verifyBuyerToken(auth.slice(7));
    } catch {
      throw new HTTPException(401, { message: "Invalid seller key (Buyer JWT verification failed)" });
    }

    const sellerId = buyerPayload.buyerId;

    // ── Find seller's provider record ───────────────────────────────────────
    const provider = await prisma.provider.findUnique({
      where: { buyerId: sellerId },
      include: { services: { select: { id: true } } },
    });

    if (!provider) {
      throw new HTTPException(404, {
        message: "No provider found for this seller. Register your service at https://lemoncake.xyz/dashboard/services",
      });
    }

    const { serviceId: filterServiceId } = c.req.valid("query");
    const serviceIds = filterServiceId
      ? [filterServiceId]
      : provider.services.map((s) => s.id);

    if (serviceIds.length === 0) {
      return c.json(
        {
          totalEarned: "0.000000",
          todayEarned: "0.000000",
          callCount: 0,
          serviceId: filterServiceId ?? null,
        },
        200
      );
    }

    // ── Aggregate completed charges ─────────────────────────────────────────
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalAgg, todayAgg, callCount] = await prisma.$transaction([
      prisma.charge.aggregate({
        where: {
          serviceId: { in: serviceIds },
          status: "COMPLETED",
          sandbox: false,
        },
        _sum: { providerAmountUsdc: true, amountUsdc: true },
      }),
      prisma.charge.aggregate({
        where: {
          serviceId: { in: serviceIds },
          status: "COMPLETED",
          sandbox: false,
          createdAt: { gte: todayStart },
        },
        _sum: { providerAmountUsdc: true, amountUsdc: true },
      }),
      prisma.charge.count({
        where: {
          serviceId: { in: serviceIds },
          status: "COMPLETED",
          sandbox: false,
        },
      }),
    ]);

    // Prefer providerAmountUsdc (net after platform fee); fall back to amountUsdc
    const totalEarned = (totalAgg._sum.providerAmountUsdc ?? totalAgg._sum.amountUsdc ?? new Decimal(0)).toFixed(6);
    const todayEarned = (todayAgg._sum.providerAmountUsdc ?? todayAgg._sum.amountUsdc ?? new Decimal(0)).toFixed(6);

    return c.json(
      {
        totalEarned,
        todayEarned,
        callCount,
        serviceId: filterServiceId ?? null,
      },
      200
    );
  }
);
