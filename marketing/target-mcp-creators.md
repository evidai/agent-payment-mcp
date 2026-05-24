# DM 送り先：MCP 作者 indie list

**選定基準：**
- Glama に掲載されている popular MCP servers
- 既に paid API key（API_KEY / TOKEN / SECRET）必須 → **既に「ユーザに支払わせる」モデル**を持ってる
- bot account 除外
- official 法人（OpenAI / Anthropic / 大企業）除外、indie dev 優先

**目的：**
LemonCake をミドルウェアとして使ってもらえば、彼らの MCP が即「USDC pay-per-call」化できる。
SaaS 化のコスト（Stripe / billing 実装）を全部肩代わりする。
彼らが取りたいけど取れていないお金が取れる。

---

## 送信先 13 名（人気順）

各人の GitHub repo を 1 分でチェック → 最近の commit / issue を 1 行 mention して open 率 up。

| # | namespace | repo | needs (paid?) | 送信ステータス |
|---|---|---|---|---|
| 1 | OneShotForge | https://github.com/OneShotForge/mcp-email | API_KEY | [ ] sent |
| 2 | PLANIT-TECH | https://github.com/PLANIT-TECH/lawbster-mcp | API_KEY | [ ] sent |
| 3 | Skeego | https://github.com/Skeego/opendata-mcp | API_KEY | [ ] sent |
| 4 | alfredoizdev | https://github.com/alfredoizdev/contextforge-mcp | CONTEXTFORGE_API_KEY | [ ] sent |
| 5 | aliasunder | https://github.com/aliasunder/vault-cortex | MCP_AUTH_TOKEN | [ ] sent |
| 6 | jrolstad | https://github.com/jrolstad/ambient-mcp | API_KEY | [ ] sent |
| 7 | mguozhen | https://github.com/mguozhen/voc-amazon-reviews | API_KEY | [ ] sent |
| 8 | mrankitvish | https://github.com/mrankitvish/RAG-MCP | API_KEY | [ ] sent |
| 9 | pauliowest | https://github.com/pauliowest/cmon-mcp | API_KEY | [ ] sent |
| 10 | pras-labs | https://github.com/pras-labs/bichon-mcp | API_KEY | [ ] sent |
| 11 | sravannerella | https://github.com/sravannerella/mulesoft-mcp-server | API_KEY | [ ] sent |
| 12 | trafficmorph-gif | https://github.com/trafficmorph-gif/tm-mcp | API_KEY | [ ] sent |
| 13 | yuechen | https://github.com/yuechen/plaid-mcp | PLAID_SECRET | [ ] sent |

**ボーナス候補（official 法人だが indie 雰囲気）：**

| # | namespace | repo | needs |
|---|---|---|---|
| 14 | mnemexa | https://github.com/mnemexa/mcp | MNEMEXA_API_KEY |
| 15 | svgicons-com | https://github.com/svgicons-com/mcp | （無料） |
| 16 | openaccountants | https://github.com/openaccountants/openaccountants | （無料） |

これら 3 つは official タグだが、API key を売ってる小規模 SaaS。LemonCake で「Stripe より安く USDC で取る」訴求が刺さる可能性。

---

## 送信前チェック（各人 1 分）

1. **repo の最近 commit を見る** — 死んでないか確認、active なら DM 価値あり
2. **`README.md` の Pricing / Billing 言及を grep** — 既に Stripe 等で取ってるか確認
3. **owner profile** — X handle / website があれば URL 付きで送信
4. **送信チャネル決定**：
   - GitHub Issue（public、低 friction、推奨）
   - X DM（follower 必要、若干 friction）
   - email（一番遠い、最後の手段）

**GitHub Issue title 例：**
> Discussion: would you accept per-call USDC payments? (3-line middleware)

→ Issue として開くと **他の visitor にも見える**ので、その人が断っても他から問い合わせ来る可能性。

---

## メッセージテンプレート（LAUNCH-KIT-V2.md 第 3 節と同一）

```
Hi {namespace},

came across your {project_name} on Glama — looks great.

quick q: have you considered per-call USDC billing? Stripe's $0.30 floor
makes $0.001-$0.05 calls unprofitable, and most agent users don't have
cards set up anyway.

I built @lemon-cake/x402-server — 3-line middleware that lets MCP/API
providers receive USDC per call. Buyer signs one permit (non-custodial,
90 days, $25/day cap), money lands in your Base wallet direct. I take
0% per-call fee.

Demo (no signup):
  npx -y agent-payment-mcp

Want to try it on {project_name}? Setup takes ~5 min:
1. https://lemoncake.xyz/sellers?utm_source=outreach&utm_medium=gh_issue&utm_campaign=mcp_creators_w1
2. Drop in the middleware
3. Done

If not interesting, what's the blocker? Genuine feedback > silence.

— hiroto / contact@aievid.com
```

---

## 送信スケジュール

- **Day 3（kit の Day 3）に一気に送る** — 月曜送信が GitHub Issue では returns 高い
- 1 人ずつ手書きで personalize（最近 commit に触れる）
- 5 人 / 時間ペース、3 時間で 15 人完了
- bounced は D+3 に 1 度だけ bump（"any feedback?"）

---

## 集計（D+7 確認）

`/admin/funnel` の「UTM キャンペーン」テーブルで `mcp_creators_w1` 行を見る：
- views（GitHub Issue 開いて LP に来た数）
- providers（実際に /sellers 登録した数）

期待値：13 件中 3-5 件返信、1-2 件登録 = 7-15% conversion なら成功
