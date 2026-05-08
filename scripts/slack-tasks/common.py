"""Shared helpers for scheduled Slack-delivery tasks running on GitHub Actions.

stdlib-only by design — works in any Python 3.9+ environment without `pip install`.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Any

DEFAULT_TIMEOUT = 20


def fetch_json(url: str, headers: dict[str, str] | None = None, timeout: int = DEFAULT_TIMEOUT) -> dict[str, Any]:
    """GET a JSON URL with sensible defaults. Raises on HTTP error."""
    req = urllib.request.Request(url, headers=headers or {"User-Agent": "lemon-cake-slack-task/0.1"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def post_to_slack(title: str, body: str) -> None:
    """POST a message to Slack via the webhook in env $SLACK_WEBHOOK_URL.

    No-op (with a warning) if the env var is missing — so a misconfigured workflow
    never fails the whole run.
    """
    webhook = os.environ.get("SLACK_WEBHOOK_URL", "").strip()
    if not webhook:
        print("warning: SLACK_WEBHOOK_URL not set — skipping Slack post", file=sys.stderr)
        return

    # Slack's text limit is 40000; leave headroom.
    max_len = 35000
    if len(body) > max_len:
        body = body[:max_len] + "\n…(以下省略)"

    payload = json.dumps({"text": f"*{title}*\n{body}"}).encode("utf-8")
    req = urllib.request.Request(
        webhook,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            r.read()
    except urllib.error.HTTPError as e:
        print(f"slack-notify: HTTP {e.code} — {e.read().decode('utf-8', errors='replace')[:200]}", file=sys.stderr)
        raise


def today_iso() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d")


def keyword_matches(text: str, keywords: list[str]) -> list[str]:
    """Return the subset of `keywords` that appear (case-insensitive substring) in `text`."""
    low = (text or "").lower()
    return [k for k in keywords if k.lower() in low]


def claude_messages(messages: list[dict], model: str = "claude-haiku-4-5", max_tokens: int = 4096, system: str | None = None) -> str:
    """Call Anthropic Messages API and return the assistant's text reply.

    Returns empty string + warning if ANTHROPIC_API_KEY is missing — caller should
    treat that as "translation unavailable" and fall back gracefully.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        print("warning: ANTHROPIC_API_KEY not set — skipping Claude translation", file=sys.stderr)
        return ""

    payload: dict[str, Any] = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": messages,
    }
    if system:
        payload["system"] = system

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read().decode("utf-8"))
        # Messages API returns content as a list of blocks; extract text blocks.
        text_parts = [b.get("text", "") for b in data.get("content", []) if b.get("type") == "text"]
        return "".join(text_parts)
    except urllib.error.HTTPError as e:
        msg = e.read().decode("utf-8", errors="replace")[:500]
        print(f"claude_messages: HTTP {e.code} — {msg}", file=sys.stderr)
        return ""
    except Exception as e:  # noqa: BLE001
        print(f"claude_messages: {e}", file=sys.stderr)
        return ""


def strip_code_fence(text: str) -> str:
    """Remove ```json ... ``` or ``` ... ``` wrappers if the model returned them."""
    t = text.strip()
    if t.startswith("```"):
        # Drop first line (```json or just ```)
        lines = t.split("\n", 1)
        t = lines[1] if len(lines) > 1 else ""
        if t.endswith("```"):
            t = t[: -3]
    return t.strip()


def enrich_with_llm(items_payload: list[dict], system_prompt: str, max_tokens: int = 8192) -> list[dict] | None:
    """Send a structured-input prompt to Claude and parse a JSON-array response.

    Convention:
    - `items_payload` items must each carry an `i` field (integer index).
    - The system prompt must instruct the model to return a JSON array of objects,
      each echoing back its `i` plus whatever fields the caller wants.
    - Returns the list reordered to match the input order, or None on any failure.
    """
    if not items_payload:
        return []

    user_msg = "Items:\n" + json.dumps(items_payload, ensure_ascii=False, indent=2)
    raw = claude_messages(
        messages=[{"role": "user", "content": user_msg}],
        model="claude-haiku-4-5",
        max_tokens=max_tokens,
        system=system_prompt,
    )
    if not raw:
        return None

    try:
        cleaned = strip_code_fence(raw)
        parsed = json.loads(cleaned)
        if not isinstance(parsed, list):
            print(f"warn: LLM returned non-list JSON: {type(parsed)}", file=sys.stderr)
            return None
        by_idx = {item.get("i", -1): item for item in parsed if isinstance(item, dict)}
        return [by_idx.get(i, {}) for i in range(len(items_payload))]
    except json.JSONDecodeError as e:
        print(f"warn: LLM JSON parse failed: {e}\nfirst 300 chars: {raw[:300]}", file=sys.stderr)
        return None


HN_KARMA_SYSTEM_PROMPT = """You are helping a Japanese-speaking founder write Hacker News comments that earn karma (upvotes).

The founder builds lemon-cake-mcp / pay-per-call-mcp / KYAPay (AI-agent payment infrastructure: per-call billing, M2M payment, agent-level budgets, MCP server). Do NOT mention these products by name in any comment — leak no URL, no name. The goal is reputation-building, not promotion.

WHAT EARNS KARMA ON HN:
- Lead with a specific number, dataset, or personal observation. ("We saw a 3x throughput drop when…", "I ran this on 12k requests and…", "In our agent that handles ~$5k/mo of API spend…")
- Share concrete experience: a specific failure mode, a workaround that worked, a number you measured.
- Add NEW information to the thread — data, technical depth, counter-example.
- Politely disagree with nuance and reasoning. Mainstream opinions get parroted; nuance gets upvoted.
- 100–250 words. Dense and specific. No hype, no "great post", no "this is interesting".
- Optionally end with one focused question — but the body must stand alone as a contribution.

WHAT BURNS KARMA / GETS DOWNVOTED:
- Pure question with no substance ("How are people handling X?")
- Vague agreement / fluff ("This is great, thanks!")
- URL drops, product mentions, anything that smells of marketing
- Generic advice anyone could write
- Excessive hedging ("I'm not sure but maybe…")

For each input item, draft a comment based on the user's domain (AI agents, MCP, LLM cost, per-call billing, autonomous systems).

Return ONLY a JSON array. Each object MUST have these exact keys:
  i              — integer, echoed back from input
  comment_en     — 100–250 word English HN comment, ready to paste, no quotes around it
  comment_jp     — natural Japanese translation of comment_en, sentence-by-sentence (not summary)
  karma_intent   — 30–60 character Japanese note explaining why this comment should earn upvotes here
  skip_reason    — empty string if this item is worth commenting on; otherwise a short Japanese reason to skip (e.g. "決済/エージェント無関係")

If the topic is far from the user's expertise (AI agents, payments, LLM, dev infra), set skip_reason and leave comment_en/comment_jp/karma_intent as empty strings.

No markdown, no commentary outside the JSON array."""


def comment_angle_hint(matches: list[str], category: str) -> str:
    """Static templated hint based on matched keywords.

    Pure-script mode has no LLM, so we generate hints from a small lookup table
    rather than fabricating angles. The user reads the hint as a starting point
    and writes the actual comment themselves.
    """
    if not matches:
        return "(該当なし)"
    has_payment = any(m in matches for m in ("payment", "billing", "x402", "stripe"))
    has_agent = any(m in matches for m in ("agent", "mcp", "autonomous", "ai-agent", "ai agent"))
    has_llm = any(m in matches for m in ("llm", "claude", "anthropic", "openai", "gpt", "sdk"))
    if has_payment and has_agent:
        return "コメント切り口: エージェントの per-call 課金で自分が踏んだ実装上の罠を 1 つ共有 (型を質問でなく経験で開く)"
    if has_agent and has_llm:
        return "コメント切り口: MCP / agent 周りで自分が試した具体的な構成 (失敗含む) を 1 段落で書く"
    if has_payment:
        return "コメント切り口: 決済まわりの実装で「ドキュメントに書いてない落とし穴」を 1 つ書く"
    if has_agent:
        return "コメント切り口: 自分が今直面しているエージェント実装上の課題を 1 つ質問形式で書く"
    if has_llm:
        return "コメント切り口: 元投稿の主張に対して、自分が観測した補強データ or 反例を 1 段落で出す"
    return f"コメント切り口: マッチしたキーワード ({', '.join(matches[:3])}) のうち最も自分の経験に近いものから入る"


def format_item_block(rank: int, title: str, url: str, hn_id: str, points: int, comments: int, matches: list[str], category: str = "") -> str:
    """Format a single digest entry in the standard Japanese-first layout.

    Title is the original English (we don't have an LLM in pure-script mode), so we
    prefix `(原題)` to make the reader's mental model clear: anything after that prefix
    is verbatim English from the source.
    """
    lines = [
        f"【{rank}】(原題) {title}  ({points}pt / {comments}c)",
    ]
    if category:
        lines.append(f"  カテゴリ: {category}")
    if matches:
        lines.append(f"  マッチキーワード: {', '.join(matches[:5])}")
    if url:
        lines.append(f"  URL: {url}")
    if hn_id:
        lines.append(f"  HN: https://news.ycombinator.com/item?id={hn_id}")
    lines.append(f"  {comment_angle_hint(matches, category)}")
    return "\n".join(lines)
