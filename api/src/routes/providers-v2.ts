/**
 * POST /api/providers/v2 — Provider v2 セルフサービス登録
 * GET  /api/providers/v2/:id — Provider v2 詳細取得
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getAddress } from "viem";
import { prisma } from "../lib/prisma.js";

export const providersV2Router = new OpenAPIHono();

const CreateProviderV2Body = z.object({
  name:              z.string().min(1).max(100),
  email:             z.string().email(),
  baseWalletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Base wallet address"),
  apiEndpointUrl:    z.string().url().optional(),
  pricePerCallUsdc:  z.string().regex(/^\d+(\.\d{1,6})?$/).default("0.005"),
  freeCallsPerMonth: z.coerce.number().int().min(0).max(1_000_000).default(1000),
});

const ProviderV2Schema = z.object({
  id:                z.string(),
  name:              z.string(),
  email:             z.string(),
  baseWalletAddress: z.string(),
  apiEndpointUrl:    z.string().nullable(),
  pricePerCallUsdc:  z.string(),
  freeCallsPerMonth: z.number(),
  apiKey:            z.string(),
  createdAt:         z.string(),
});

// ─── POST /api/providers/v2 ──────────────────────────────────

providersV2Router.openapi(
  createRoute({
    method:  "post",
    path:    "/",
    tags:    ["Providers"],
    summary: "Provider v2 登録（セルフサービス）",
    request: {
      body: {
        content: { "application/json": { schema: CreateProviderV2Body } },
        required: true,
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: ProviderV2Schema } },
        description: "登録成功",
      },
      409: {
        content: { "application/json": { schema: z.object({ error: z.string() }) } },
        description: "Email または walletAddress が既に登録済み",
      },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const body = c.req.valid("json");

    // 重複チェック
    const existing = await prisma.providerV2.findFirst({
      where: {
        OR: [
          { email: body.email },
          { baseWalletAddress: body.baseWalletAddress },
        ],
      },
    });
    if (existing) {
      const field = existing.email === body.email ? "email" : "baseWalletAddress";
      return c.json({ error: `${field} is already registered` }, 409);
    }

    // EIP-55 チェックサム正規化（大文字小文字混在を統一し、不正アドレスを排除）
    let checksumAddress: string;
    try {
      checksumAddress = getAddress(body.baseWalletAddress);
    } catch {
      return c.json({ error: "Invalid Ethereum address (checksum failed)" }, 400);
    }

    const provider = await prisma.providerV2.create({
      data: {
        name:              body.name,
        email:             body.email,
        baseWalletAddress: checksumAddress,
        apiEndpointUrl:    body.apiEndpointUrl ?? null,
        pricePerCallUsdc:  body.pricePerCallUsdc,
        freeCallsPerMonth: body.freeCallsPerMonth,
      },
    });

    return c.json(
      {
        id:                provider.id,
        name:              provider.name,
        email:             provider.email,
        baseWalletAddress: provider.baseWalletAddress,
        apiEndpointUrl:    provider.apiEndpointUrl ?? null,
        pricePerCallUsdc:  provider.pricePerCallUsdc.toString(),
        freeCallsPerMonth: provider.freeCallsPerMonth,
        apiKey:            provider.apiKey,
        createdAt:         provider.createdAt.toISOString(),
      },
      201,
    );
  },
);

// ─── GET /api/providers/v2/:id ───────────────────────────────

providersV2Router.openapi(
  createRoute({
    method:  "get",
    path:    "/:id",
    tags:    ["Providers"],
    summary: "Provider v2 詳細取得",
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: ProviderV2Schema.omit({ apiKey: true }) } },
        description: "Provider 詳細（apiKey を除く）",
      },
      404: {
        content: { "application/json": { schema: z.object({ error: z.string() }) } },
        description: "Not Found",
      },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const { id } = c.req.valid("param");
    const provider = await prisma.providerV2.findUnique({ where: { id } });
    if (!provider) return c.json({ error: "Provider not found" }, 404);

    return c.json({
      id:                provider.id,
      name:              provider.name,
      email:             provider.email,
      baseWalletAddress: provider.baseWalletAddress,
      apiEndpointUrl:    provider.apiEndpointUrl ?? null,
      pricePerCallUsdc:  provider.pricePerCallUsdc.toString(),
      freeCallsPerMonth: provider.freeCallsPerMonth,
      createdAt:         provider.createdAt.toISOString(),
    });
  },
);
