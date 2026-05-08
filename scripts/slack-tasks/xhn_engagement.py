"""xhn-engagement-opportunity-scan — pure-script (GitHub Actions) version.

Phase 1: fetch HN top stories from last 24h, filter for AI-agent / MCP / payment
relevance.
Phase 2 (only if ANTHROPIC_API_KEY is present): call Claude Haiku 4.5 with the
filtered items and get back per-item:
  - English HN comment draft (100-250 words, karma-optimized, ready to paste)
  - Japanese sentence-by-sentence translation
  - Japanese intent memo (why this comment should earn upvotes)
Phase 3: Japanese-first digest to Slack. If Phase 2 was skipped, fall back to
the static-hint format.
"""

from __future__ import annotations

import sys
import time
import traceback

from common import (
    HN_KARMA_SYSTEM_PROMPT,
    enrich_with_llm,
    fetch_json,
    keyword_matches,
    post_to_slack,
    today_iso,
)

KEYWORDS = [
    "mcp", "agent", "llm", "claude", "anthropic", "x402", "payment", "billing",
    "stripe", "openai", "sdk", "gpt", "autonomous", "ai-agent", "ai agent",
]


def gather() -> tuple[list[dict], int]:
    since = int(time.time()) - 86400
    url = (
        "https://hn.algolia.com/api/v1/search"
        f"?tags=story&numericFilters=created_at_i%3E{since}%2Cpoints%3E20"
        "&hitsPerPage=30"
    )
    data = fetch_json(url)
    hits = data.get("hits", [])

    scored = []
    for h in hits:
        text = (h.get("title") or "") + " " + (h.get("url") or "")
        m = keyword_matches(text, KEYWORDS)
        if m:
            scored.append((len(m), h, m))
    scored.sort(key=lambda t: -t[0])
    return [{"score": s, "h": h, "m": m} for (s, h, m) in scored[:12]], len(hits)


def build_payload(items: list[dict]) -> list[dict]:
    return [
        {
            "i": idx,
            "title_en": it["h"].get("title") or "",
            "url": it["h"].get("url") or "",
            "hn_url": f"https://news.ycombinator.com/item?id={it['h'].get('objectID', '')}",
            "points": it["h"].get("points") or 0,
            "comments": it["h"].get("num_comments") or 0,
            "matched_keywords": it["m"],
        }
        for idx, it in enumerate(items)
    ]


def format_with_drafts(items: list[dict], enriched: list[dict], total: int) -> str:
    lines = [
        f"{today_iso()} X/HN エンゲージメント候補 ({len(items)} 件 / 走査 {total} 件中) — HN カルマ獲得用フル英文+和訳",
        "",
    ]
    for rank, (it, e) in enumerate(zip(items, enriched), 1):
        h = it["h"]
        skip = e.get("skip_reason") or ""
        lines.append(f"【{rank}】(原題) {h.get('title','')}  ({h.get('points',0)}pt / {h.get('num_comments',0)}c)")
        lines.append(f"  マッチ: {', '.join(it['m'][:5])}")
        if h.get("url"):
            lines.append(f"  URL: {h['url']}")
        lines.append(f"  HN: https://news.ycombinator.com/item?id={h.get('objectID','')}")

        if skip:
            lines.append(f"  ⏭️ スキップ推奨: {skip}")
            lines.append("")
            lines.append("─" * 40)
            lines.append("")
            continue

        comment_en = (e.get("comment_en") or "").strip()
        comment_jp = (e.get("comment_jp") or "").strip()
        karma = (e.get("karma_intent") or "").strip()

        if comment_en:
            lines.append("")
            lines.append("  HN コメント案 (英、そのまま貼れる):")
            for line in comment_en.split("\n"):
                lines.append(f"    {line}")
            lines.append("")
        if comment_jp:
            lines.append("  HN コメント案 (和訳):")
            for line in comment_jp.split("\n"):
                lines.append(f"    {line}")
            lines.append("")
        if karma:
            lines.append(f"  カルマ獲得意図: {karma}")
        lines.append("")
        lines.append("─" * 40)
        lines.append("")

    if not items:
        lines.append("(本日は関連する 24h 以内のストーリーなし)")
    return "\n".join(lines)


def format_static_fallback(items: list[dict], total: int) -> str:
    lines = [
        f"{today_iso()} X/HN エンゲージメント候補 ({len(items)} 件 / 走査 {total} 件中)",
        "",
        "(注: ANTHROPIC_API_KEY が未設定のため英文コメントドラフトはスキップ。",
        "GitHub Secrets に追加すると次回からカルマ獲得用フル英文+和訳付きで届きます。)",
        "",
    ]
    for rank, it in enumerate(items, 1):
        h = it["h"]
        lines.append(f"【{rank}】(原題) {h.get('title','')}  ({h.get('points',0)}pt / {h.get('num_comments',0)}c)")
        lines.append(f"  マッチ: {', '.join(it['m'][:5])}")
        if h.get("url"):
            lines.append(f"  URL: {h['url']}")
        lines.append(f"  HN: https://news.ycombinator.com/item?id={h.get('objectID','')}")
        lines.append("")
    if not items:
        lines.append("(本日は関連する 24h 以内のストーリーなし)")
    return "\n".join(lines)


def run() -> None:
    items, total = gather()
    enriched = enrich_with_llm(build_payload(items), HN_KARMA_SYSTEM_PROMPT) if items else []

    if enriched is not None and any(e for e in enriched):
        body = format_with_drafts(items, enriched, total)
    else:
        body = format_static_fallback(items, total)

    print(body)
    post_to_slack("X/HN エンゲージメント候補", body)


if __name__ == "__main__":
    try:
        run()
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        post_to_slack("X/HN エンゲージメント候補 (失敗)", f"{today_iso()} 実行失敗: {e}")
        sys.exit(1)
