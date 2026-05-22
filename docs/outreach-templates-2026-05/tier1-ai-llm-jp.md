# Tier 1 — 日本語 LLM / NLP API 事業者向け（JP）

対象: ELYZA, rinna, Lightblue, Stockmark, PKSHA, AI Shift, ABEJA, exaWizards, AI inside, MNTSQ, studio ousia, モリカトロン, Plus Alpha Consulting, Preferred Networks

---

## 件名（A/B テスト推奨）

A:「【{会社名}様】貴社 API の AI エージェント自律決済対応のご提案」
B:「{会社名}の API を Claude/Cursor から USDC で呼び出せるようにしたい件」

---

## 本文テンプレ

```
{担当者様 or ご担当者様}

突然のご連絡失礼します。AI エージェント向け非カストディ USDC マイクロペイメント基盤「LemonCake」（https://lemoncake.xyz）を運営している Evid AI 佐藤と申します。

【LemonCake が何か】
Claude / Cursor / Cline などの AI エージェントが、有料 API を 1 リクエスト $0.001 から USDC で自律決済できる Stripe 的 SDK です。金融庁 Fintech サポートデスクへの照会 Q1-Q11 で「非カストディ設計が登録不要」とご回答頂いており、規制グリーンで運営中です。

【貴社へのご提案】
{会社名}様の {具体的 API 名 e.g. ELYZA LLM API / DX Suite OCR API} を、agent-payment-mcp（npm 公開済、月 DL 数 増加中）の marketplace に掲載させて頂きたく、ご相談です。

特に貴社が出される {会社名}-specific な日本語 AI API は、海外の Claude/Cursor ユーザが「日本語タスクで困ったときに呼ぶ」用途に強いと考えています。

【Provider 側の負担ゼロ】
- 登録は 1 分、KYC / 法人登記不要
- 月 1,000 call まで LemonCake が肩代わり（御社の取り分は 100%）
- USDC は貴社の Base ウォレットに直接着金
- freee / MoneyForward 自動仕訳 + 適格請求書自動発行
- Pro プラン以上で Coincheck 経由 JPY オフランプ

【次のステップ】
30 分ほどお時間を頂ければ、貴社専用の serviceId を発行して動作デモまで進められます。お時間が難しければ、まずドキュメント（https://lemoncake.xyz/sellers）だけでもご確認頂けますと幸いです。

ご質問・ご興味あれば、本メールにご返信ください。

---
Evid AI（屋号）
佐藤 宏人
contact@aievid.com
LemonCake: https://lemoncake.xyz
GitHub: https://github.com/evidai/agent-payment-mcp
```

---

## パーソナライズすべき箇所

- `{会社名}` → 各社名（敬称付き）
- `{担当者様}` → 名前わかれば実名、わからなければ「ご担当者様」
- `{具体的 API 名}` → 各社が出してる代表 API（後述リスト参照）

## API 名差し込み参考

| 会社 | API 名 |
|---|---|
| ELYZA | ELYZA-japanese-Llama 系 API |
| rinna | rinna LM API |
| Lightblue | 日本語 NLP / RAG API |
| Stockmark | Anews API（ニュース要約 / キュレーション） |
| PKSHA | BEDORE API（チャットボット） |
| AI Shift | AI Messenger Voicebot API |
| ABEJA | ABEJA Platform / GenAI API |
| exaWizards | exaBase Generative AI |
| AI inside | DX Suite API（AI-OCR） |
| MNTSQ | リーガル文書解析 API |
| studio ousia | QA / 知識抽出 API |
| モリカトロン | ゲーム AI / NPC API |
| Plus Alpha Consulting | HR / 組織 AI API |
| Preferred Networks | PFN R&D / 産業 AI API |
