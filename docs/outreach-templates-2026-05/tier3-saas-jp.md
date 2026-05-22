# Tier 3 — 既存 SaaS API 事業者向け（JP）

対象: Money Forward, Sansan, LayerX, Cybozu kintone, HENNGE, SmartHR, BizReach, カオナビ, ANDPAD, スマレジ, Stora, Money Tree

※ freee は連携掲載開始済（個別フォロー別途）

---

## 件名

「【{会社名}様】貴社 API を AI エージェント決済対応にする 1 行統合のご提案」

---

## 本文テンプレ

```
{ご担当者様}

突然のご連絡失礼します。AI エージェント向け非カストディ USDC マイクロペイメント基盤「LemonCake」（https://lemoncake.xyz）を運営している Evid AI 佐藤と申します。

【ご提案】
{会社名}様の API（{API 名 e.g. SmartHR API / Sansan Data Hub}）を、Claude / Cursor / Cline などの AI エージェント運用者が「per-call USDC 決済」で呼び出せる形に対応させて頂きたく、ご相談です。

【背景】
日本企業の業務 SaaS API は、AI エージェント時代において「1 つのエージェントが日本企業のバックオフィスを自動運用」する用途で非常に価値が高いと考えています。ただし API キー配布・課金処理が障壁になりやすいため、LemonCake が中間レイヤーとして「permit 1 署名で 90 日委任」「per-call USDC 決済」「freee / MF 自動仕訳」を提供します。

LemonCake は金融庁 Fintech サポートデスクへの照会 Q1-Q11 で「非カストディ設計が登録不要」回答取得済み、現在 freee も連携掲載スタート済みです。

【貴社の利点】
- AI エージェント時代の新規導線：海外エージェント運用者からの新規 API 需要を取り込み
- 既存課金モデル維持：vs フラット月額のサブスク顧客は対象外、エージェント用途のみ
- 売上 100% 貴社受取（LemonCake は per-call から margin 取らない）
- ユーザー側の費用負担小：月 1,000 call まで LemonCake 肩代わり
- バックオフィス完結：適格請求書自動発行 + 仕訳自動化 + Coincheck JPY オフランプ

【次のステップ】
ご興味あれば 30 分のオンライン面談でデモまでご案内可能です。
資料：https://lemoncake.xyz/sellers

ご質問・ご興味あれば、本メールにご返信ください。

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
| Money Forward | MF Cloud API |
| Sansan | Sansan Data Hub |
| LayerX | バクラク API |
| Cybozu | kintone API |
| HENNGE | HENNGE One ID 認証 API |
| SmartHR | SmartHR 人事 API |
| BizReach | HRMOS 採用 API |
| カオナビ | カオナビ HR API |
| ANDPAD | ANDPAD 施工管理 API |
| スマレジ | スマレジ POS API |
| Stora | Stora 自動精算 API |
| Money Tree | LINK 金融データ API |
