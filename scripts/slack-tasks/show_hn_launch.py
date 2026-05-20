"""show-hn-launch-monitor — pure-script (GitHub Actions) version.

Phase 1: fetch Show HN + front page from last 24h, filter for relevance.
Phase 2 (only if ANTHROPIC_API_KEY is present): call Claude Haiku 4.5 with the
filtered launches and get back per-item:
  - English HN comment draft (100-250 words, karma-optimized, ready to paste)
  - Japanese sentence-by-sentence translation
  - Japanese intent memo
For Show HN posts, the system prompt nudges the model toward "tester perspective"
(I tried this, here's what I observed) which lands well on Show HN threads.
Phase 3: Japanese-first digest to Slack with category labels.
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
    "stripe", "openai", "sdk", "autonomous", "ai-agent", "ai agent", "model context",
    "tool use", "rag", "vector", "retrieval", "copilot", "assistant",
]

# Override the generic HN system prompt with a Show-HN-specific addendum that
# nudges the model toward tester / architect perspectives — these get karma on
# Show HN where the OP is the founder seeking real feedback.
SHOW_HN_SYSTEM_PROMPT = HN_KARMA_SYSTEM_PROMPT + """

ADDITIONAL CONTEXT — Show HN posts:
For items in the [Show HN] category (where the OP is launching their own product), prefer ONE of these proven karma patterns:

1. TESTER perspective: "I tried it on <specific use case>. <specific observation>. <one suggestion>." — concrete, generous, useful to OP and readers.
2. ARCHITECT perspective: "This is similar to <named alternative>, but the differentiator seems to be <specific>. The thing I'd want to see is <specific>." — comparative, technical, fair.
3. FAILURE-MODE perspective: "I've built something in this space and the trickiest thing was <specific edge case>. How are you handling it?" — only if you genuinely have built in this space (which the founder has — agent payment infra). Frames as peer-to-peer.

Tone for Show HN: generous + specific. Avoid harsh critique unless the issue is technical and concrete.

For [FrontPage] / non-Show-HN items, the original karma rules apply (lead with data/experience/counter-example)."""


def categorize(matches: list[str]) -> str:
    has_payment = any(m in matches for m in ("payment", "billing", "x402", "stripe"))
    has_agent = any(m in matches for m in ("agent", "mcp", "autonomous", "ai-agent", "ai agent"))
    if has_payment and has_agent:
        return "COMPETITOR"
    if has_agent or "model context" in matches:
        return "ADJACENT"
    return "SIGNAL"


def gather() -> tuple[list[dict], int]:
    """Fetch Show HN + front-page items from the last 8h, weight by freshness.

    The OP of a Show HN is most active in the first few hours after posting,
    which is exactly when a thoughtful comment drives the most reply rate
    AND visibility. Tighter window than the previous 24h to focus on this.
    """
    now = int(time.time())
    since = now - 8 * 3600
    url = (
        "https://hn.algolia.com/api/v1/search_by_date"
        f"?tags=(show_hn,front_page)&numericFilters=created_at_i%3E{since}"
        "&hitsPerPage=80"
    )
    data = fetch_json(url)
    hits = data.get("hits", [])

    scored = []
    for h in hits:
        text = (h.get("title") or "") + " " + (h.get("story_text") or "") + " " + (h.get("url") or "")
        m = keyword_matches(text, KEYWORDS)
        if not m:
            continue
        is_show = "show_hn" in (h.get("_tags") or [])
        age_hours = (now - (h.get("created_at_i") or now)) / 3600.0
        # Show HN gets a +1.5 base (founder is actively watching the thread,
        # comment value is higher). Freshness weighted 2x: a 1h-old match
        # outranks a 6h-old match even at same relevance.
        freshness = max(0.0, (6.0 - age_hours) / 6.0)
        score = float(len(m)) + (1.5 if is_show else 0.0) + freshness * 2.0
        scored.append((score, age_hours, h, m, is_show))
    scored.sort(key=lambda t: -t[0])
    return [
        {"h": h, "m": m, "is_show": is_show, "age_hours": age}
        for (_, age, h, m, is_show) in scored[:10]
    ], len(hits)


def build_payload(items: list[dict]) -> list[dict]:
    return [
        {
            "i": idx,
            "title_en": it["h"].get("title") or "",
            "url": it["h"].get("url") or "",
            "hn_url": f"https://news.ycombinator.com/item?id={it['h'].get('objectID', '')}",
            "points": it["h"].get("points") or 0,
            "comments": it["h"].get("num_comments") or 0,
            "is_show_hn": it["is_show"],
            "age_hours": round(it["age_hours"], 1),
            "matched_keywords": it["m"],
            "category": categorize(it["m"]),
        }
        for idx, it in enumerate(items)
    ]


def _freshness_badge(age_hours: float) -> str:
    if age_hours < 2:
        return "🆕 (新着)"
    if age_hours < 4:
        return "🟢 (高返信率帯)"
    if age_hours < 6:
        return "🟡 (まだ返信率あり)"
    return "🔴 (返信率低下)"


def _item_header(rank: int, h: dict, m: list[str], is_show: bool, age_hours: float, marker: str | None = None) -> list[str]:
    prefix = "[Show HN] " if is_show else "[FrontPage] "
    cat = categorize(m)
    head = marker if marker else f"【{rank}】"
    lines = [
        f"{head} {prefix}(原題) {h.get('title','')[:90]}  ({h.get('points',0)}pt / {h.get('num_comments',0)}c)",
        f"  投稿: {age_hours:.1f} 時間前  {_freshness_badge(age_hours)}",
        f"  カテゴリ: {cat}",
        f"  マッチ: {', '.join(m[:5])}",
    ]
    if h.get("url"):
        lines.append(f"  URL: {h['url']}")
    lines.append(f"  HN: https://news.ycombinator.com/item?id={h.get('objectID','')}")
    if h.get("author"):
        lines.append(f"  by @{h['author']}")
    return lines


def format_with_drafts(items: list[dict], enriched: list[dict], total: int) -> str:
    pick_idx = next((i for i, e in enumerate(enriched) if e.get("pick_today")), None)

    lines = [
        f"{today_iso()} Show HN / 新着ローンチ監視 ({len(items)} 件 / 走査 {total} 件中) — 直近 8h、返信率重視",
        "",
        "**ポスト再開モード (post-green careful re-entry)**",
        "- カルマ低いので **1 日 1 件まで** 投稿。下の ⭐ マークの 1 件を選んで貼る。",
        "- 残りは「明日以降の参考」リストとして surface のみ。",
        "",
    ]
    if pick_idx is None:
        lines.append("(LLM が今日の pick を選べなかった。下のリストから手動で 1 件選んで判断)")
        lines.append("")

    for rank, (it, e) in enumerate(zip(items, enriched), 1):
        is_pick = e.get("pick_today") is True
        marker = "⭐ 今日の 1 件" if is_pick else None
        lines.extend(_item_header(rank, it["h"], it["m"], it["is_show"], it["age_hours"], marker=marker))

        skip = (e.get("skip_reason") or "").strip()
        if skip:
            lines.append(f"  ⏭️ スキップ推奨: {skip}")
            lines.append("")
            lines.append("─" * 40)
            lines.append("")
            continue

        # For non-pick items, hide the full draft (reduce clutter).
        if not is_pick and pick_idx is not None:
            lines.append("  (明日以降の参考候補。ドラフトは pick が変わったら自動生成)")
            lines.append("")
            lines.append("─" * 40)
            lines.append("")
            continue

        comment_en = (e.get("comment_en") or "").strip()
        comment_jp = (e.get("comment_jp") or "").strip()
        karma = (e.get("karma_intent") or "").strip()

        if comment_en:
            lines.append("")
            lines.append("  HN コメント案 (英、≤30 words、観察者リード、そのまま貼れる):")
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
        lines.append("(本日は関連する Show HN / フロントページ記事なし)")
    return "\n".join(lines)


def format_static_fallback(items: list[dict], total: int) -> str:
    lines = [
        f"{today_iso()} Show HN / 新着ローンチ監視 ({len(items)} 件 / 走査 {total} 件中) — 直近 8h",
        "",
        "(注: ANTHROPIC_API_KEY が未設定のため英文コメントドラフトはスキップ。",
        "GitHub Secrets に追加すると次回からカルマ獲得用フル英文+和訳付きで届きます。)",
        "",
    ]
    for rank, it in enumerate(items, 1):
        lines.extend(_item_header(rank, it["h"], it["m"], it["is_show"], it["age_hours"]))
        lines.append("")
    if not items:
        lines.append("(直近 8 時間に該当 Show HN / フロントページ記事なし)")
    return "\n".join(lines)


def run() -> None:
    items, total = gather()
    enriched = enrich_with_llm(build_payload(items), SHOW_HN_SYSTEM_PROMPT) if items else []

    if enriched is not None and any(e for e in enriched):
        body = format_with_drafts(items, enriched, total)
    else:
        body = format_static_fallback(items, total)

    print(body)
    post_to_slack("Show HN / 新着ローンチ監視", body)


if __name__ == "__main__":
    try:
        run()
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        post_to_slack("Show HN 監視 (失敗)", f"{today_iso()} 実行失敗: {e}")
        sys.exit(1)
