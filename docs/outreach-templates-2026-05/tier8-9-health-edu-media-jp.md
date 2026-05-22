# Tier 8 + 9 — ヘルスケア / 教育 / メディア / コンテンツ（JP）

対象:
- Tier 8: Ubie, M3, HOKUTO, メドピア, Schoo, N 高（KADOKAWA）, Speak, mikan
- Tier 9: ニコニコ動画, pixiv, Voicy, stand.fm, LINE NEWS, News Picks, Tably

→ ニッチだが熱量高い。「AI エージェントが大量に呼ぶ」需要は今後増える。

---

## 件名

「【{会社名}様】貴社 API の AI エージェント従量課金対応のご提案」

---

## 本文テンプレ（汎用版）

```
{ご担当者様}

突然のご連絡失礼します。AI エージェント向け非カストディ USDC マイクロペイメント基盤「LemonCake」（https://lemoncake.xyz）を運営している Evid AI 佐藤と申します。

【背景】
Claude / Cursor / Cline 等の AI エージェントが「ユーザーに代わって専門サービス API を呼び出す」用途が拡大しています。{会社名}様の {分野 e.g. 医療情報 / 学習コンテンツ / 音声配信データ} は、エージェントから per-call で参照される潜在的需要が大きい領域です。

【ご提案】
{会社名}様の API（{API 名 e.g. Ubie 症状チェッカー API / Schoo 学習データ API}）を、AI エージェントから「1 リクエスト $0.001〜」の従量課金で呼べる形に対応させて頂きたく、ご相談です。

【LemonCake のスタンス】
- 金融庁 Fintech サポートデスクへの照会 Q1-Q11 で「非カストディ設計が登録不要」回答取得済
- 売上 100% 貴社受取、LemonCake は per-call から margin 取らない
- 既存ビジネスとカニバらない設計（B2C 用途は対象外、AI エージェント用途のみ）
- USDC は貴社 Base ウォレットに直接着金、freee / MoneyForward 仕訳自動化、適格請求書自動発行
- 月 1,000 call まで LemonCake 負担

【リーチ】
- npm `agent-payment-mcp`：MCP server、月 DL 増加中
- Coinbase x402 Bazaar / AWS Bedrock AgentCore で自動掲載

【次のステップ】
30 分のオンラインヒアリング、または資料（https://lemoncake.xyz/sellers）のみ先にご確認頂ければ幸いです。

---
Evid AI（屋号）
佐藤 宏人
contact@aievid.com
LemonCake: https://lemoncake.xyz
GitHub: https://github.com/evidai/agent-payment-mcp
```
