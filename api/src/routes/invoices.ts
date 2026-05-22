/**
 * /api/invoices — 適格請求書（インボイス制度準拠）の発行・取得・送信
 *
 *   POST   /api/invoices                  期間指定で生成（DRAFT → 必要なら issue）
 *   GET    /api/invoices?providerV2Id=…   一覧
 *   GET    /api/invoices/:id              詳細
 *   POST   /api/invoices/:id/issue        DRAFT → ISSUED（不変化）
 *   POST   /api/invoices/:id/send         メール送信（stub）
 *
 *   GET    /api/invoices/:id/pdf          PDF ダウンロード（簡易 HTML→PDF）
 *
 *   月末 cron で provider.autoIssueInvoices=true な provider 全部の
 *   前月分を一括生成する仕組みは別ジョブで実装（Task 2 のフォロー）。
 *
 * 計算ロジック（v0）:
 *   - 期間内の PermitCharge (status=COMPLETED) を providerV2 ごとに集計
 *   - totalUsdc を発行時の USD/JPY レートで totalJpy に換算
 *   - taxRate=10% で taxAmount を計算（10%課税対象、軽減税率は別途実装）
 *   - exchangeRate は ExchangeRate-API 等の外部 fetch（v0 は固定 150 でフォールバック）
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { prisma } from "../lib/prisma.js";
import { Decimal } from "@prisma/client/runtime/library";

export const invoicesRouter = new OpenAPIHono();

// ─── スキーマ ──────────────────────────────────────────────────

const CreateInvoiceBody = z.object({
  providerV2Id: z.string().min(1),
  periodFrom:   z.string().datetime(),  // ISO 8601
  periodTo:     z.string().datetime(),
  // permit owner address ごとに分けて発行する場合は指定（未指定なら全 buyer 合算）
  buyerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  buyerName:    z.string().optional(),
  buyerEmail:   z.string().email().optional(),
  // 税率（10.00 = 10%）。指定なければ 10。軽減税率対応は v1
  taxRate:      z.coerce.number().min(0).max(100).default(10),
});

const InvoiceSchema = z.object({
  id:                 z.string(),
  providerV2Id:       z.string(),
  registrationNumber: z.string(),
  buyerAddress:       z.string(),
  buyerName:          z.string().nullable(),
  buyerEmail:         z.string().nullable(),
  periodFrom:         z.string(),
  periodTo:           z.string(),
  callCount:          z.number(),
  totalUsdc:          z.string(),
  totalJpy:           z.string(),
  taxRate:            z.string(),
  taxAmount:          z.string(),
  exchangeRate:       z.string(),
  pdfUrl:             z.string().nullable(),
  emailSent:          z.boolean(),
  status:             z.enum(["DRAFT","ISSUED","SENT","PAID","VOIDED"]),
  issuedAt:           z.string(),
});

// 発行時の USD/JPY レート取得。本番では ExchangeRate-API / 三菱 UFJ 等の
// 公式レートを fetch するが、v0 は固定値（fallback も同じ）で発行する。
async function fetchUsdJpyRate(): Promise<number> {
  try {
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD", { signal: AbortSignal.timeout(2000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { rates?: { JPY?: number } };
    const jpy = data.rates?.JPY;
    if (typeof jpy === "number" && jpy > 0) return jpy;
  } catch { /* fallback below */ }
  return 150;  // 安全側フォールバック
}

function serialize(i: {
  id: string; providerV2Id: string; registrationNumber: string;
  buyerAddress: string; buyerName: string | null; buyerEmail: string | null;
  periodFrom: Date; periodTo: Date; callCount: number;
  totalUsdc: Decimal; totalJpy: Decimal; taxRate: Decimal;
  taxAmount: Decimal; exchangeRate: Decimal;
  pdfUrl: string | null; emailSent: boolean; status: string;
  issuedAt: Date;
}) {
  return {
    id:                 i.id,
    providerV2Id:       i.providerV2Id,
    registrationNumber: i.registrationNumber,
    buyerAddress:       i.buyerAddress,
    buyerName:          i.buyerName,
    buyerEmail:         i.buyerEmail,
    periodFrom:         i.periodFrom.toISOString(),
    periodTo:           i.periodTo.toISOString(),
    callCount:          i.callCount,
    totalUsdc:          i.totalUsdc.toString(),
    totalJpy:           i.totalJpy.toString(),
    taxRate:            i.taxRate.toString(),
    taxAmount:          i.taxAmount.toString(),
    exchangeRate:       i.exchangeRate.toString(),
    pdfUrl:             i.pdfUrl,
    emailSent:          i.emailSent,
    status:             i.status as "DRAFT"|"ISSUED"|"SENT"|"PAID"|"VOIDED",
    issuedAt:           i.issuedAt.toISOString(),
  };
}

// ─── POST /api/invoices ────────────────────────────────────────
// 期間指定で DRAFT インボイスを生成。集計対象が 0 件なら 400。

invoicesRouter.openapi(
  createRoute({
    method:  "post",
    path:    "/",
    tags:    ["Invoices"],
    summary: "期間指定でインボイスを生成（DRAFT）",
    request: { body: { content: { "application/json": { schema: CreateInvoiceBody } }, required: true } },
    responses: {
      201: { content: { "application/json": { schema: InvoiceSchema } }, description: "DRAFT 生成成功" },
      400: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Bad Request" },
      404: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Provider not found" },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const body = c.req.valid("json");

    const provider = await prisma.providerV2.findUnique({ where: { id: body.providerV2Id } });
    if (!provider) return c.json({ error: "Provider not found" }, 404);
    if (!provider.registrationNumber) {
      return c.json({ error: "Provider must register an invoice registration number (T+13 digits) first" }, 400);
    }

    const periodFrom = new Date(body.periodFrom);
    const periodTo   = new Date(body.periodTo);
    if (periodFrom >= periodTo) {
      return c.json({ error: "periodFrom must be before periodTo" }, 400);
    }

    // 集計対象 PermitCharge を取得
    const where = {
      serviceId: provider.id,
      createdAt: { gte: periodFrom, lt: periodTo },
      status:    "COMPLETED" as const,
      ...(body.buyerAddress ? { ownerAddress: body.buyerAddress } : {}),
    };
    const charges = await prisma.permitCharge.findMany({ where });
    if (charges.length === 0) {
      return c.json({ error: "No completed charges in this period" }, 400);
    }

    const totalUsdc = charges.reduce(
      (sum, ch) => sum.add(ch.amountUsdc),
      new Decimal(0),
    );

    const rate = await fetchUsdJpyRate();
    const totalJpy = totalUsdc.mul(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const taxRate  = new Decimal(body.taxRate);
    // 内税ではなく外税方式：本体 / (1 + tax) で本体を出し、差額が消費税
    const taxAmount = totalJpy.mul(taxRate).div(new Decimal(100).add(taxRate)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    // buyer が明示されていない場合は first charge の owner を仮置き
    const buyerAddress = body.buyerAddress ?? charges[0]!.ownerAddress;

    const inv = await prisma.invoice.create({
      data: {
        providerV2Id:       provider.id,
        registrationNumber: provider.registrationNumber,
        buyerAddress,
        buyerName:          body.buyerName ?? null,
        buyerEmail:         body.buyerEmail ?? null,
        periodFrom,
        periodTo,
        callCount:          charges.length,
        totalUsdc:          totalUsdc.toString(),
        totalJpy:           totalJpy.toString(),
        taxRate:            taxRate.toString(),
        taxAmount:          taxAmount.toString(),
        exchangeRate:       rate.toString(),
        status:             "DRAFT",
      },
    });

    return c.json(serialize(inv), 201);
  },
);

// ─── GET /api/invoices?providerV2Id=… ──────────────────────────

invoicesRouter.openapi(
  createRoute({
    method:  "get",
    path:    "/",
    tags:    ["Invoices"],
    summary: "Provider のインボイス一覧",
    request: {
      query: z.object({
        providerV2Id: z.string().min(1),
        status:       z.enum(["DRAFT","ISSUED","SENT","PAID","VOIDED"]).optional(),
        limit:        z.coerce.number().int().min(1).max(200).default(50),
      }),
    },
    responses: {
      200: { content: { "application/json": { schema: z.array(InvoiceSchema) } }, description: "一覧" },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const q = c.req.valid("query");
    const rows = await prisma.invoice.findMany({
      where: {
        providerV2Id: q.providerV2Id,
        ...(q.status ? { status: q.status } : {}),
      },
      orderBy: { issuedAt: "desc" },
      take:    q.limit,
    });
    return c.json(rows.map(serialize));
  },
);

// ─── GET /api/invoices/:id ─────────────────────────────────────

invoicesRouter.openapi(
  createRoute({
    method:  "get",
    path:    "/:id",
    tags:    ["Invoices"],
    summary: "インボイス詳細",
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { content: { "application/json": { schema: InvoiceSchema } }, description: "詳細" },
      404: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Not found" },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const { id } = c.req.valid("param");
    const inv = await prisma.invoice.findUnique({ where: { id } });
    if (!inv) return c.json({ error: "Invoice not found" }, 404);
    return c.json(serialize(inv));
  },
);

// ─── POST /api/invoices/:id/issue ──────────────────────────────
// DRAFT → ISSUED への昇格。発行後は不変。

invoicesRouter.openapi(
  createRoute({
    method:  "post",
    path:    "/:id/issue",
    tags:    ["Invoices"],
    summary: "DRAFT を ISSUED に昇格",
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { content: { "application/json": { schema: InvoiceSchema } }, description: "ISSUED" },
      400: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Bad state" },
      404: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Not found" },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const { id } = c.req.valid("param");
    const inv = await prisma.invoice.findUnique({ where: { id } });
    if (!inv) return c.json({ error: "Invoice not found" }, 404);
    if (inv.status !== "DRAFT") {
      return c.json({ error: `Invoice is ${inv.status}, only DRAFT can be issued` }, 400);
    }
    const updated = await prisma.invoice.update({
      where: { id },
      data:  { status: "ISSUED" },
    });
    return c.json(serialize(updated));
  },
);

// ─── POST /api/invoices/:id/send ───────────────────────────────
// メール送信スタブ（v0 は emailSent=true にするだけ）

invoicesRouter.openapi(
  createRoute({
    method:  "post",
    path:    "/:id/send",
    tags:    ["Invoices"],
    summary: "インボイスをメール送信（stub）",
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { content: { "application/json": { schema: InvoiceSchema } }, description: "Sent" },
      400: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Bad state" },
      404: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Not found" },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const { id } = c.req.valid("param");
    const inv = await prisma.invoice.findUnique({ where: { id } });
    if (!inv) return c.json({ error: "Invoice not found" }, 404);
    if (inv.status === "DRAFT") {
      return c.json({ error: "Issue the invoice first (DRAFT → ISSUED) before sending" }, 400);
    }
    if (!inv.buyerEmail) {
      return c.json({ error: "buyerEmail is required to send" }, 400);
    }
    // TODO: 実際の SMTP / Resend / SendGrid 統合
    const updated = await prisma.invoice.update({
      where: { id },
      data:  { status: "SENT", emailSent: true, sentAt: new Date() },
    });
    return c.json(serialize(updated));
  },
);

// ─── GET /api/invoices/:id/pdf — HTML preview ──────────────────
// 本番では PDF だが v0 は適格請求書フォーマットの HTML を返す。
// ブラウザの「印刷 → PDF として保存」で十分実用に耐える。

invoicesRouter.get("/:id/pdf", async (c) => {
  const id = c.req.param("id");
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: { providerV2: true },
  });
  if (!inv) return c.json({ error: "Invoice not found" }, 404);

  const html = renderInvoiceHtml(inv);
  return new Response(html, {
    headers: {
      "Content-Type":  "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
});

function renderInvoiceHtml(inv: {
  id: string;
  registrationNumber: string;
  buyerAddress: string; buyerName: string | null; buyerEmail: string | null;
  periodFrom: Date; periodTo: Date;
  callCount: number; totalUsdc: Decimal; totalJpy: Decimal;
  taxRate: Decimal; taxAmount: Decimal; exchangeRate: Decimal;
  issuedAt: Date;
  providerV2: { name: string; email: string; baseWalletAddress: string };
}): string {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const fmtYen = (d: Decimal) =>
    "¥" + d.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const taxExclusive = new Decimal(inv.totalJpy).sub(inv.taxAmount);
  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><title>請求書 ${inv.id}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif; max-width: 720px; margin: 40px auto; padding: 20px; color: #1a1a1a; }
  h1 { text-align: center; font-size: 28px; letter-spacing: 0.4em; margin-bottom: 32px; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 32px; font-size: 13px; }
  .issuer { text-align: right; }
  .issuer p { margin: 0.2em 0; }
  table { width: 100%; border-collapse: collapse; margin: 24px 0; }
  th, td { border: 1px solid #ccc; padding: 8px 12px; font-size: 13px; }
  th { background: #f5f5f5; text-align: left; }
  .total td { font-weight: bold; background: #fafafa; }
  .footer { margin-top: 40px; font-size: 11px; color: #666; border-top: 1px solid #eee; padding-top: 16px; }
  @media print { body { margin: 0; } button { display: none; } }
</style></head>
<body>
  <h1>請  求  書</h1>

  <div class="meta">
    <div>
      <p><strong>${inv.buyerName ?? "—"}</strong> 御中</p>
      <p style="font-size:11px;color:#666">Wallet: ${inv.buyerAddress}</p>
      ${inv.buyerEmail ? `<p style="font-size:11px;color:#666">${inv.buyerEmail}</p>` : ""}
    </div>
    <div class="issuer">
      <p><strong>${inv.providerV2.name}</strong></p>
      <p>登録番号: ${inv.registrationNumber}</p>
      <p>${inv.providerV2.email}</p>
      <p style="font-size:11px;color:#666">発行日: ${fmt(inv.issuedAt)}</p>
      <p style="font-size:11px;color:#666">請求書番号: ${inv.id.slice(0, 12)}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr><th>取引内容</th><th>取引期間</th><th>件数</th><th style="text-align:right">金額</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>API 利用料 (LemonCake 経由)</td>
        <td>${fmt(inv.periodFrom)} 〜 ${fmt(inv.periodTo)}</td>
        <td>${inv.callCount.toLocaleString()}</td>
        <td style="text-align:right">${fmtYen(taxExclusive)}</td>
      </tr>
    </tbody>
  </table>

  <table>
    <tr><td>小計（税抜）</td><td style="text-align:right">${fmtYen(taxExclusive)}</td></tr>
    <tr><td>消費税（${inv.taxRate.toString()}%）</td><td style="text-align:right">${fmtYen(inv.taxAmount)}</td></tr>
    <tr class="total"><td>合計（税込）</td><td style="text-align:right">${fmtYen(new Decimal(inv.totalJpy))}</td></tr>
  </table>

  <div class="footer">
    <p>※ 本請求書は適格請求書（インボイス制度）に準拠しています。</p>
    <p>※ 原資産: ${inv.totalUsdc.toString()} USDC（USD/JPY = ${inv.exchangeRate.toString()} で換算）</p>
    <p>※ USDC は Base チェーン上で Provider のウォレット (${inv.providerV2.baseWalletAddress.slice(0,6)}…${inv.providerV2.baseWalletAddress.slice(-4)}) に直接転送されています。</p>
  </div>

  <p style="text-align:center;margin-top:24px"><button onclick="window.print()">PDF として保存（印刷）</button></p>
</body></html>`;
}
