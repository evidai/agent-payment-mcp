/**
 * CloudSign Webhook ハンドラー
 *
 * POST /api/webhooks/cloudsign
 *
 * CloudSign が署名完了時に送信する Webhook を受け取り、
 * CONTRACTING → ORDER_LOCKED に遷移して次のステップへ進む。
 *
 * 署名検証: X-CloudSign-Signature ヘッダー（HMAC-SHA256）
 */

import { Hono } from "hono";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma }        from "../../lib/prisma.js";
import { transitionState, type WorkflowContext } from "../../lib/workflow-engine.js";
import { getWorkflowQueue } from "../../lib/queue.js";

export const cloudsignWebhookRouter = new Hono();

cloudsignWebhookRouter.post("/", async (c) => {
  // ── 1. HMAC 署名検証 ──────────────────────────────────────
  // SECURITY: previously `if (secret && signature)` meant the verification
  // was SKIPPED when either side was empty — an attacker could simply
  // omit the X-CloudSign-Signature header and the webhook passed through.
  // Also compared with `!==` which is timing-attack vulnerable.
  // Fixed in v0.7.0 after the 2026-05 @kleosr audit (H-01, H-02).
  const signature = c.req.header("X-CloudSign-Signature");
  const rawBody   = await c.req.text();
  const secret    = process.env.CLOUDSIGN_WEBHOOK_SECRET;
  const allowUnsigned =
    process.env.CLOUDSIGN_ALLOW_UNSIGNED === "yes-i-understand" &&
    process.env.NODE_ENV !== "production";

  if (!secret) {
    if (!allowUnsigned) {
      console.error("[CloudSign] CLOUDSIGN_WEBHOOK_SECRET is not set — rejecting webhook");
      return c.json({ error: "Webhook not configured" }, 503);
    }
    console.warn("[CloudSign] Running with no secret — dev only");
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
      console.warn("[CloudSign] Invalid webhook signature");
      return c.json({ error: "Invalid signature" }, 401);
    }
  }

  // ── 2. ペイロード解析 ─────────────────────────────────────
  let payload: { event: string; document: { id: string; status: string } };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  // 署名完了イベントのみ処理
  if (payload.event !== "document.completed" || payload.document?.status !== "completed") {
    return c.json({ ok: true, skipped: true });
  }

  const docId = payload.document.id;

  // ── 3. contractDocId で Workflow を検索 ───────────────────
  const workflows = await prisma.workflow.findMany({
    where: { state: "CONTRACTING" },
  });

  const target = workflows.find(
    (wf) => (wf.context as unknown as WorkflowContext).contractDocId === docId,
  );

  if (!target) {
    console.warn(`[CloudSign] No CONTRACTING workflow found for docId: ${docId}`);
    return c.json({ ok: true, matched: false });
  }

  // ── 4. CONTRACTING → ORDER_LOCKED に遷移 ─────────────────
  const ok = await transitionState(target.id, "CONTRACTING", "ORDER_LOCKED", {
    contractSignedAt: new Date().toISOString(),
  });

  if (ok) {
    // タイムアウトジョブを削除
    try {
      const queue = getWorkflowQueue();
      const timeoutJob = await queue.getJob(`timeout-${target.id}`);
      await timeoutJob?.remove();
    } catch { /* ignore */ }

    // 次ステップ: ORDER_LOCKED（発注 + 資金ロック）
    await getWorkflowQueue().add(
      "order",
      { workflowId: target.id, step: "ORDER_LOCKED" },
    );

    console.log(`[CloudSign] ✅ Contract signed — workflow ${target.id} → ORDER_LOCKED`);
  }

  return c.json({ ok: true, workflowId: target.id, transitioned: ok });
});
