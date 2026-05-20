import { Router, Request, Response } from "express";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

/** Global halt flag — shared across this module */
let isHalted = false;

/** Exported getter used by other routes */
export function getHaltState(): boolean {
  return isHalted;
}

/**
 * POST /api/killswitch
 * Body: { halt: boolean }
 * Auth: X-Admin-Key header (validated by requireAdmin middleware)
 *
 * Sets the global isHalted flag.
 * When true, POST /api/transfer returns 403.
 *
 * SECURITY NOTE: prior to v0.7.0 this endpoint was unauthenticated — anyone
 * with network access could halt all transfers. (Reported by @kleosr, C-02
 * of 2026-05 audit.)
 */
router.post("/", requireAdmin, (req: Request, res: Response) => {
  const { halt } = req.body as { halt?: boolean };

  if (typeof halt !== "boolean") {
    res.status(400).json({ error: '"halt" must be a boolean' });
    return;
  }

  const previous = isHalted;
  isHalted = halt;

  // Audit log — who, when, what changed.
  // The admin key itself is not logged (only the fact that it validated).
  const actor =
    (req.headers["x-forwarded-for"] as string | undefined) ??
    req.socket.remoteAddress ??
    "unknown";
  // eslint-disable-next-line no-console
  console.log(
    `[killswitch] ${new Date().toISOString()} actor=${actor} halt: ${previous} -> ${isHalted}`
  );

  res.json({
    isHalted,
    message: isHalted
      ? "System halted. All transfers are blocked."
      : "System resumed. Transfers are allowed.",
  });
});

/**
 * GET /api/killswitch  (convenience — check current state)
 *
 * Read-only and intentionally unauthenticated so health checks, the
 * admin dashboard, and downstream services can poll without credentials.
 * Only reveals the boolean halt state — no sensitive data.
 */
router.get("/", (_req: Request, res: Response) => {
  res.json({ isHalted });
});

export default router;
