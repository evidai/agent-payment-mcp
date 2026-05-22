# Tier 5 — 旅行・食・不動産・コンシューマ系（JP）

対象: 楽天 API, リクルート（じゃらん/ホットペッパー/SUUMO/カーセンサー）, ぐるなび, LIFULL HOME'S, CARMO (DeNA SOMPO), オープンハウス, トリップ AI

→ 大手中心、PLG 単独で刺さりにくい。「AI エージェントが大量に call する用途」訴求。

---

## 件名

「【{会社名}様】AI エージェント時代の API 流通：1 リクエスト単位のマイクロ課金導入のご提案」

---

## 本文テンプレ

```
{ご担当者様}

突然のご連絡失礼します。AI エージェント向け非カストディ USDC マイクロペイメント基盤「LemonCake」（https://lemoncake.xyz）を運営している Evid AI 佐藤と申します。

【AI エージェント時代の新流通網】
2025 年以降、Claude / Cursor / Cline 等の AI エージェントが「予算を持って自律的に API を呼ぶ」用途が急拡大しており、{会社名}様のような大規模データ・コンテンツ事業者にとって、新しい高頻度トラフィック源になりつつあります。

【ご提案】
{会社名}様の {API 名 e.g. じゃらん API / ぐるなび API / SUUMO API} を、AI エージェントから「1 call $0.001〜」の従量課金で利用できる形に対応させて頂きたく、ご相談です。

【既存ビジネスとカニバらない設計】
- B2C 利用（アフィリエイト等）は対象外、エージェント / プログラマティック利用のみ
- 自由な単価設定（$0.001〜$0.10）、売上 100% 貴社受取
- LemonCake は per-call から margin を取らない（収益は別経路の月額 SaaS のみ）

【リーチ】
- npm `agent-payment-mcp`：月 DL 数 増加中（特に日本語タスクで日本データを呼びたい海外ユーザー）
- Coinbase x402 Bazaar 自動掲載 → AWS Bedrock AgentCore 経由でも発見可能
- 月 1,000 call まで LemonCake が肩代わり

【規制】
- 金融庁 Fintech サポートデスクへの照会 Q1-Q11 で「非カストディ設計が登録不要」回答取得済
- USDC は貴社の Base ウォレットに直接着金（LemonCake 経由なし）

【次のステップ】
30 分のオンラインヒアリングのお時間頂けますと幸いです。資料：https://lemoncake.xyz/sellers

---
Evid AI（屋号）
佐藤 宏人
contact@aievid.com
LemonCake: https://lemoncake.xyz
GitHub: https://github.com/evidai/agent-payment-mcp
```
