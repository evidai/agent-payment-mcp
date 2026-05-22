/**
 * /en/about — Redirect to existing /about/en (which has full English copy).
 * Kept as a thin alias so middleware-redirected non-JP IPs land somewhere.
 */

import { redirect } from "next/navigation";

export default function AboutEnAlias() {
  redirect("/about/en");
}
