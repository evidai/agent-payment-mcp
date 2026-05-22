# セッション引き継ぎ — 2026-05-22

> このファイルは「前回までの会話で何が起き、何が決まり、次に何をすべきか」を
> **別チャットセッションのAIが完全に理解できる**ように圧縮した記録。
> 関連ファイルが同じ git tree にあれば、これ1枚で文脈再構築できる。

---

## 0. 何者か（プロダクト概要）

**LemonCake** = AI エージェント / MCP サーバー向け **非カストディ USDC マイクロペイメント** インフラ。

- ユーザーは ERC-2612 permit を 1 度署名（90 日有効、daily cap $25）
- AI が API を叩くたびに、permit を使って `transferFrom(user → provider)`
- LemonCake は USDC を一切預からない（FSA Q1–Q11 確認済、非登録 OK）
- 5 npm パッケージ公開済：
  - `agent-payment-mcp` v0.7.3
  - `@lemon-cake/mcp-sdk` v0.2.1
  - `alpaca-guard-mcp` v0.1.2
  - `xstocks-mcp` v0.1.5
  - `tokenized-stock-mcp` v0.1.5

**現在の URL**:
- LP: https://lemoncake.xyz
- v2 オンボーディング: https://lemoncake.xyz/start/v2
- ダッシュボード: lemoncake.xyz/（ログイン後）
- Provider 登録: lemoncake.xyz/sellers
- API: https://skillful-blessing-production.up.railway.app

---

## 1. 今日（2026-05-22）何が起きたか

### A. v2 launch を一晩で本番化

| やったこと | 状態 |
|---|---|
| Privy embedded wallet（Google/Email/Wallet ログイン） | ✅ |
| Coinbase Onramp（Apple Pay → USDC, US 向け） | ✅ Sandbox 動作確認済 |
| Transak Onramp（銀行振込/コンビニ → USDC, JP 向け） | ✅ Production API key |
| ERC-2612 permit 署名フロー（Base 8453） | ✅ 本番動作中 |
| spender 実アドレス（旧 0xDEAD から） | ✅ `0x23e0D435b62d8eABE2b239c461Ec6fb2E8B7E965` |
| メータリング基盤（PermitCharge DB） | ✅ Prisma + Supabase |
| Provider 登録フロー（/sellers + /api/providers/v2） | ✅ |
| v2 統一ダッシュボード（buyer/seller 廃止） | ✅ |

### B. 戦略リサーチ完了 → マネタイズ方針確定

#### 市場調査結論（自分 + 別 AI 突き合わせ済）

| 軸 | 結論 |
|---|---|
| TAM | AI エージェント市場 $7.8B (2025) → $52.6B (2030)、Agentic commerce $46B → $175-385B |
| MCP エコシステム | 月 97M SDK DL、公開サーバー 9,400+（12ヶ月で 8 倍） |
| 致命的競合 | **x402（規格）** + **Circle Agent Stack**（5/11 launch） |
| 脅威じゃない | Stripe Agentic Suite（US only）、Payman AI（銀行 ACH 領域）、Privy/Pimlico/Biconomy/Lit（補完インフラ） |
| 窓 | **Closing**（6-9 ヶ月で閉まる） |

#### LemonCake の ARR 予測（修正版）

| 年 | Low | **Mid** | High |
|---|---|---|---|
| 2026 Y1 | $0-10K | $5-20K | $20-50K |
| 2027 Y2 | $20-80K | $100-250K | $300-700K |
| 2028 Y3 | $100-400K | **$700K-$1.8M** | $2.5-5M（Series A line） |
| 2030 Y5 | $1-3M | **$6-12M** | $20-35M |

→ **元メモリの「Y3 $4.75M ARR」は high case であり mid じゃない**。下方修正必要。

#### 戦略転換 — 「決済会社になるな」

- **per-call 手数料は x402 と完全同価格 $0.001/call** にする（commodity 化）
- 真の収益軸は「**日本ビジネス特化サブスク**」
- 「MCP 乗せるのは無料、freee 自動仕訳 / インボイス / JPY オフランプは有料」
- 勝ち筋 = 「MCP devs 向け **日本発デフォルト checkout**」

#### 価格モデル（確定）

| プラン | 月額 | 含 call | 超過 | 機能 |
|---|---|---|---|---|
| Free | ¥0 | 1,000 | ¥0.15/call (=$0.001) | 基本機能 |
| **Pro** | **¥2,980** | 10,000 | ¥0.15/call | freee/MF 仕訳、インボイス、分析 |
| **Business** | **¥9,800** | 100,000 | ¥0.10/call | JPY オフランプ、複数 wallet、SLA |
| Enterprise | 個別 | 個別 | 個別 | 専用サポート、白ラベル |

→ 1,000 provider で年 ~$110K ARR、10,000 で ~$1.1M ARR

---

## 2. 現状のコード（重要ファイル）

### Dashboard (`/Users/workoutsomehow/adhunt-pro/dashboard/`)

- `app/start/v2/page.tsx` — 非カストディオンボーディング（本番動作）
- `app/sellers/page.tsx` — Provider 登録フォーム（先日追加）
- `app/page.tsx` — メインダッシュボード（4,200 行、モノリス）
  - Page 型: `overview | permits | usage | marketplace | publish | settings`（v2 統一済）
  - 旧 buyer/seller toggle 廃止済
  - `AccountingPage` コンポーネントは残存（line ~3340）、ナビから外れてるだけ
- `app/Providers.tsx` — Privy + Wagmi + OnchainKit 階層

### API (`/Users/workoutsomehow/adhunt-pro/api/`)

- `src/index.ts` — Hono エントリ、ルーター登録（v2 系を前置 match で先に登録）
- `src/routes/charges-permit.ts` — v2 permit ベース課金エンドポイント
- `src/routes/providers-v2.ts` — v2 provider 登録 / 取得
- `src/routes/accounting.ts` — **既存・稼働中**（freee/MF/QB/Xero/Zoho/Sage OAuth）
- `src/routes/charge.ts` — v1 custody charge（残存・別レイヤー）
- `src/lib/usdc-base-permit.ts` — Base 上の permit + transferFrom
- `prisma/schema.prisma` — `PermitCharge` + `ProviderV2` 追加済

### 環境変数

**Vercel (lemon-cake project)**
```
NEXT_PUBLIC_PRIVY_APP_ID=cmpflzv8x006y0cl71k5gfn2y
NEXT_PUBLIC_COINBASE_PROJECT_ID=76JepOcpEdXnRfWArr6UV2HoADNMLe6X
NEXT_PUBLIC_TRANSAK_API_KEY=7db8aeda-226a-48e3-bc43-aa024f57a651
NEXT_PUBLIC_API_URL=https://skillful-blessing-production.up.railway.app  # 要確認
```

**Railway (skillful-blessing)**
```
BASE_SPENDER_PRIVATE_KEY=0xef0b01da08d83786ac7526978ba35ad1ca1dc47cdb6b5bb911cebdafd348c25a
BASE_RPC_URL=https://mainnet.base.org
HOT_WALLET_PRIVATE_KEY=...（v1 用、変更不要）
POLYGON_RPC_URL=...
DATABASE_URL=postgres@aws-1-ap-northeast-1.pooler.supabase.com:5432
（freee/MF/Stripe 等の既存 OAuth/secret は loadSecretsFromGCP で取得）
```

---

## 3. デプロイ方法（重要）

| 対象 | コマンド |
|---|---|
| Dashboard | `git push origin main`（Vercel auto-deploy） |
| API | `cd api && railway up --detach`（Railway 強制再デプロイ） |
| Prisma schema | `cd api && npx prisma db push`（migrate dev は シャドー DB エラーで使えない） |

**落とし穴**:
- `prisma migrate dev` → `Migration 20260417000000_add_charge_rollup failed in shadow database` で死ぬ → **必ず `db push`**
- Hono ルート登録は前置一致 → `/api/charges/permit` は `/api/charges` より先に登録（既に修正済）
- viem v2.47 で `writeContract` が `authorizationList` を要求 → `as any` キャストで回避（既存パターン）
- Vercel デプロイ前に env を `vercel env add` でセット必要

---

## 4. 次にやる 5 タスク（実行順）

詳細は `docs/HANDOFF_v2_monetization.md` 参照。要約：

| # | タスク | 工数 | 概要 |
|---|---|---|---|
| 1 | 会計連携復活 | 0.5d | `AccountingPage` を `publish` ページ内のタブとして再配線 |
| 2 | インボイス発行機能 | 2d | Prisma に `Invoice` model 追加、適格請求書 PDF 自動生成 |
| 3 | JPY オフランプ | 2d | Coincheck API 連携、USDC → JPY → 銀行口座 |
| 4 | サブスク UI | 3d | Stripe Billing 統合、Pro/Business プラン、価格を $0.001 に |
| 5 | x402 互換実装 | 1-2w | `@lemoncake/x402-server` middleware + `/api/x402/verify` |

**合計 約 4 週間（1 人月）**

実行順序：1 → 2 → 4 → 3 → 5

---

## 5. 重要な確定済意思決定

### やる
- ✅ x402 P0 化（独自プロトコル捨てる、互換に振り切る）
- ✅ 価格を $0.001/call（x402 と完全一致）
- ✅ サブスクモデル導入（per-call から SaaS 月額へ）
- ✅ 会計連携復活（freee/MF を Pro プランで unlock）
- ✅ JPY オフランプ統合（Coincheck 優先、bitFlyer バックアップ）
- ✅ インボイス制度対応

### やらない
- ❌ Zenn 記事 / X 投稿（メモリで明示）
- ❌ B2B 営業（PLG オーガニック）
- ❌ Stripe Crypto onramp（US only、JP 不可）
- ❌ パターン2（スマコン経由 5% 強制徴収）— FSA「媒介」リスク
- ❌ パターン3（ユーザー Pro $19/月）— 構造的に成立しない
- ❌ Custody 設計（FSA 登録回避が最重要）

### 削除済みコード（戻さない）
- USDC/JPYC チャージページ（v1 custody 時代）
- トークン発行ページ（Pay Token JWT — v2 で不要）
- 旧「販売者向け APIキー」ページ
- 「ホーム」の「USDC残高をチャージ」CTA

---

## 6. 競合ポジショニング（要記憶）

### 致命的脅威
- **x402**（Coinbase 主導の規格、22 社 Foundation） → **乗る**
- **Circle Agent Stack**（USDC 発行者、Nanopayments $0.000001/call） → **非カストディと日本ローカライズで差別化**

### 脅威じゃない
- **Stripe Agentic Suite** — US only、EC 領域、API/MCP 領域とズレる
- **Payman AI** — 銀行 ACH 領域、マイクロ決済じゃない
- **Privy/Pimlico/Biconomy/Lit** — 補完インフラ（LemonCake は Privy 上で動く）

### 中脅威
- **Crossmint**（$23.6M Series A、40K devs） — エンタープライズ向け、PLG dev 層は別
- **Skyfire**（$9.5M seed、20 ヶ月 Series A なし） — 手数料 2-3% 重い、隙あり

---

## 7. メモリファイル参照

`~/.claude/projects/-Users-workoutsomehow-adhunt-pro/memory/MEMORY.md` がメイン index。
v2 関連は `memory/project_v2_launch_2026-05-22.md` に全文記録あり。

ただし **メモリの「Y3 = $4.75M ARR」は high case と判明**。本ファイルの修正版数値を優先。

---

## 8. このセッションで作成 / 変更したコミット

```
8707724 docs: handoff spec for v2 monetization (5 tasks)
ba2898e chore(sibling-mcps): bump patches for v2 README republish
82b10b4 chore(agent-payment-mcp): bump to v0.7.3 for v2 README republish
715b4c8 refactor: dead code purge + v2 permit messaging across READMEs
1c36329 refactor(dashboard): unified v2 sidebar — drop buyer/seller role split
f35fbce fix: audit fixes — quota logic, idempotency, address validation, API_BASE
7453b06 fix(api): register providers/v2 and charges/permit before parent routes
5ab990e feat(v2): spender address + metering + provider registration
70ac5a0 refactor(/start/v2): simplify top banner — drop FSA jargon
96db10e feat(onramp): add Transak JPY onramp button to /start/v2 Step 2
beb95ff feat(onramp): mint Coinbase session tokens server-side
（以前: 8e22df7 feat(onramp): wire Coinbase Smart Wallet + Apple Pay onramp）
```

---

## 9. 別セッションでの再開方法

新しいチャットを開いたら、最初にこう書く：

```
このリポジトリ /Users/workoutsomehow/adhunt-pro で LemonCake の作業をしています。
まず以下を読んで全文脈を把握してください：

1. /Users/workoutsomehow/adhunt-pro/docs/SESSION_CONTEXT_2026-05-22.md（前回までの記録）
2. /Users/workoutsomehow/adhunt-pro/docs/HANDOFF_v2_monetization.md（次にやる5タスクの詳細）

読み終わったら、Task 1（会計連携復活）から実行してください。
```

これだけで前回までの判断・戦略・現状コードを完全に再構築できる。

---

## 10. 緊急時連絡先 / リカバリ

- DB バックアップ: Supabase auto backup（dashboard から手動取得可）
- Railway rollback: `railway redeploy <deployment-id>`
- Vercel rollback: dashboard から 1 クリック
- 秘密鍵紛失時: `BASE_SPENDER_PRIVATE_KEY` は Railway env のみに存在、紛失すると spender アドレスを再生成して全 provider に通知する必要あり

---

**最終更新**: 2026-05-22 深夜  
**次回再開時のコンテキスト窓**: このファイル + `HANDOFF_v2_monetization.md` の 2 枚で完全に復元可能
