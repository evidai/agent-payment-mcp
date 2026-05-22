# Tier 2 — データ API 事業者向け（JP）

対象: gBizINFO, 帝国データバンク, 東京商工リサーチ, ヴァル研究所, ジョルダン, NAVITIME, みんかぶ, Quick, DataSign, ライナフ, 建築データバンク

---

## 件名

「{会社名}様 API を AI エージェントから USDC で従量課金できる仕組みのご提案」

---

## 本文テンプレ

```
{ご担当者様}

突然のご連絡失礼します。AI エージェント向け非カストディ USDC マイクロペイメント基盤「LemonCake」（https://lemoncake.xyz）を運営している Evid AI 佐藤と申します。

【ご提案】
{会社名}様の {API 名 e.g. 駅すぱあと API / COSMOS2 / TSR-ID} を、Claude / Cursor / Cline などの AI エージェントから「1 call ${単価} で USDC 決済」で呼び出せる形で提供させて頂きたく、ご相談です。

【背景】
2025 年から MCP（Model Context Protocol）+ x402（HTTP 402 ベース決済）が AI エージェント決済の標準として急速に普及しており、海外のエージェント運用者は「日本のニッチ・高品質データ API を 1 件単位で従量課金で使いたい」需要が顕在化しています。

LemonCake はこの導線を非カストディで提供する Stripe 的 SDK で、金融庁 Fintech サポートデスクへの照会で「資金移動業・暗号資産交換業のいずれにも該当せず」とご回答頂いており、規制グリーンで運営中です。

【貴社の利点】
- 新規 API 収益源：海外エージェント市場向けの新規流通網
- 既存サブスクモデルとカニバらない：1 call 単位の従量課金専用
- 売上 100% 貴社受取（LemonCake は per-call 経路に立たない）
- USDC は貴社の Base ウォレットに直接着金
- 月 1,000 call まで LemonCake が肩代わり（初期コストゼロ）
- 適格請求書（インボイス制度）自動発行、freee / MoneyForward 自動仕訳
- Coincheck 経由 JPY オフランプで JPY 銀行口座着金

【次のステップ】
ドキュメントを 5 分ほどご確認頂ければ全体像つかめます：
https://lemoncake.xyz/sellers

ご質問・ご興味あれば、本メールにご返信ください。30 分のオンライン面談（Google Meet）でデモまでご案内可能です。

---
Evid AI（屋号）
佐藤 宏人
contact@aievid.com
LemonCake: https://lemoncake.xyz
GitHub: https://github.com/evidai/agent-payment-mcp
```

## API 差し込み参考

| 会社 | API |
|---|---|
| gBizINFO | gBizINFO API（経産省、無料公開）|
| 帝国データバンク | COSMOS2 |
| 東京商工リサーチ | TSR-ID API |
| ヴァル研究所 | 駅すぱあと API |
| ジョルダン | 乗換案内 API |
| NAVITIME | NAVITIME API |
| みんかぶ | 株データ API |
| Quick | 経済情報サービス API |
| DataSign | bizon 与信 API |
| ライナフ | 不動産物件 + IoT API |
| 建築データバンク | 建築実例 API |
