/**
 * AfterShip Webhook ハンドラー
 *
 * POST /api/webhooks/aftership
 *
 * AfterShip が「Delivered」ステータスを送信してきたら
 * VERIFYING → TAX_PENDING に遷移し、税務ステップへ進む。
 *
 * 署名検証: HMAC-SHA256（AfterShip ダッシュボードで設定）
 */

import { Hono } from "hono";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma }        from "../../lib/prisma.js";
import { transitionState, type WorkflowContext } from "../../lib/workflow-engine.js";
import { getWorkflowQueue } from "../../lib/queue.js";

export const aftershipWebhookRouter = new Hono();

aftershipWebhookRouter.post("/", async (c) => {
  // ── 1. HMAC 署名検証 ──────────────────────────────────────
  // SECURITY: previously `if (secret && signature)` meant verification
  // was SKIPPED when either side was empty — an attacker could just
  // omit the signature header. Plus `!==` was timing-attack vulnerable.
  // Fixed in v0.7.0 after the 2026-05 @kleosr audit (H-01, H-02).
  const signature = c.req.header("Aftership-Hmac-Sha256");
  const rawBody   = await c.req.text();
  const secret    = process.env.AFTERSHIP_WEBHOOK_SECRET;
  const allowUnsigned =
    process.env.AFTERSHIP_ALLOW_UNSIGNED === "yes-i-understand" &&
    process.env.NODE_ENV !== "production";

  if (!secret) {
    if (!allowUnsigned) {
      console.error("[AfterShip] AFTERSHIP_WEBHOOK_SECRET is not set — rejecting webhook");
      return c.json({ error: "Webhook not configured" }, 503);
    }
    console.warn("[AfterShip] Running with no secret — dev only");
  } else {
    if (!signature) {
      return c.json({ error: "Missing signature header" }, 401);
    }
    const expected = createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    const a = Buffer.from(signature, "utf8");
    const b = Buffer.from(expected, "utf8");
    const valid = a.length === b.length && timingSafeEqual(a, b);
    if (!valid) {
      console.warn("[AfterShip] Invalid webhook signature");
      return c.json({ error: "Invalid signature" }, 401);
    }
  }

  // ── 2. ペイロード解析 ─────────────────────────────────────
  let payload: {
    event: string;
    msg?: {
      tracking_number?: string;
      tag?:             string;  // "Delivered" | "InTransit" | etc.
      last_updated_at?: string;
    };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  // Delivered イベントのみ処理
  if (payload.msg?.tag !== "Delivered") {
    return c.json({ ok: true, skipped: true, tag: payload.msg?.tag });
  }

  const trackingNumber = payload.msg.tracking_number;
  if (!trackingNumber) return c.json({ ok: true, skipped: true });

  // ── 3. trackingNumber で Workflow を検索 ──────────────────
  const workflows = await prisma.workflow.findMany({
    where: { state: "VERIFYING" },
  });

  const target = workflows.find(
    (wf) => (wf.context as unknown as WorkflowContext).trackingNumber === trackingNumber,
  );

  if (!target) {
    console.warn(`[AfterShip] No VERIFYING workflow for tracking: ${trackingNumber}`);
    return c.json({ ok: true, matched: false });
  }

  // ── 4. VERIFYING → TAX_PENDING に遷移 ────────────────────
  const ok = await transitionState(target.id, "VERIFYING", "TAX_PENDING", {
    deliveredAt: payload.msg.last_updated_at ?? new Date().toISOString(),
  });

  if (ok) {
    // タイムアウトジョブ削除
    try {
      const queue = getWorkflowQueue();
      const timeoutJob = await queue.getJob(`timeout-${target.id}`);
      await timeoutJob?.remove();
    } catch { /* ignore */ }

    // 次ステップ: TAX_PENDING
    await getWorkflowQueue().add(
      "tax",
      { workflowId: target.id, step: "TAX_PENDING" },
    );

    console.log(`[AfterShip] ✅ Delivered — workflow ${target.id} → TAX_PENDING`);
  }

  return c.json({ ok: true, workflowId: target.id, transitioned: ok });
});
