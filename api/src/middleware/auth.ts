/**
 * 管理者リクエスト用JWT認証ミドルウェア
 * エージェントからのPay Token検証は各ルートで個別に行う
 */

import { createMiddleware } from "hono/factory";
import { jwtVerify } from "jose";
import { HTTPException } from "hono/http-exception";

function getAdminSecret(): Uint8Array {
  // SECURITY: Admin tokens must use their own signing key, never the same
  // symmetric secret used for Pay/Buyer tokens. Previously fell back to
  // JWT_SECRET — leaking any Pay Token's signing path would have let an
  // attacker forge admin tokens with full system access. (C-07 / H-04 of
  // the 2026-05 @kleosr audit.)
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "ADMIN_JWT_SECRET must be set independently (≥32 chars). Do not share with JWT_SECRET."
    );
  }
  return new TextEncoder().encode(secret);
}

export const adminAuth = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Missing Authorization header" });
  }

  const token = authHeader.slice(7);
  try {
    const { payload } = await jwtVerify(token, getAdminSecret(), {
      issuer: "kyapay-admin",
    });
    // コンテキストにロールを格納
    c.set("adminId", payload.sub as string);
  } catch {
    throw new HTTPException(401, { message: "Invalid or expired admin token" });
  }

  await next();
});
