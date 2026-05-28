import { redirect } from "next/navigation";

/**
 * `/` is no longer a routable page. The legacy buyer dashboard (~4,300 lines)
 * was removed 2026-05-28 — it required a `buyer_token` from an auth backend
 * that doesn't exist for self-serve, so no real visitor ever reached it.
 *
 * Middleware already redirects `/` → `/about` (or `/about/en` by locale)
 * before this file runs. This page is a defense-in-depth fallback in case
 * the middleware matcher ever misses a request — we still want `/` to
 * resolve to the LP, never a blank or 404.
 *
 * If/when a real authenticated dashboard returns, restore the page here.
 */
export default function RootRedirect() {
  redirect("/about");
}
