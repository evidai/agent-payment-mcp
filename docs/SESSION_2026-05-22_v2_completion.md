# LemonCake v2 マネタイズ完成セッション — 2026-05-22

> SESSION_CONTEXT_2026-05-22.md の続編。
> Task 1–5 を全部実行 + 価格修正 + /sellers UX 全面リファクタ + 管理者画面 v2 化 + デプロイ復旧。

---

## 0. 30秒サマリー

HANDOFF_v2_monetization.md の Task 1〜5 を順番（1→2→4→3→5）に全部完走。途中で価格を ¥2,980→¥4,980 / ¥9,800→¥14,800 に修正。/sellers を 5 ステップウィザードに書き直し。管理者画面を v2 KPI 中心に作り替え。最後に Railway デプロイが 5 回連続失敗していた原因（missing secrets）を突き止めて復旧。

**起点コミット**: `1d62ef8` (Task 1 完了)
**終点コミット**: `496d317` (デプロイ復旧クリーンアップ)
**コミット数**: ~30
**追加ファイル**: 9 (API 6, dashboard 1, components 1, npm package 1)
**コード総量**: +5,200 / -1,800 行

---

## 1. 完了タスク全体像

| # | タスク | 状態 | 主要コミット |
|---|---|---|---|
| 1 | 会計連携復活（freee/MF） | ✅ | `1d62ef8` |
| 2 | インボイス発行（適格請求書） | ✅ | `215c771` |
| 4 | サブスク UI + 価格 $0.001 | ✅ | `33c5ae7` |
| 3 | JPY オフランプ（Coincheck） | ✅ | `e70d1bc` |
| 5 | x402 互換 + hybrid mode | ✅ | `e43d9c9`, `cf1ffc9` |
| — | 価格修正（Pro/Business） | ✅ | `19db702` |
| — | /sellers UX rewrite | ✅ | `19db702`, `57512c4`, `f07ee6a` |
| — | 管理者画面 v2 化 | ✅ | `f0b80b0`, `4fb4719` |
| — | デプロイ復旧 | ✅ | `496d317` |

---

## 2. Task 2: インボイス発行機能

### Prisma 追加
```prisma
model Invoice {
  id            String @id @default(cuid())
  providerV2Id  String
  providerV2    ProviderV2 @relation(...)
  registrationNumber String      // T+13桁スナップショット
  buyerAddress  String
  buyerName/Email String?
  periodFrom/To DateTime
  callCount     Int
  totalUsdc     Decimal @db.Decimal(38, 18)
  totalJpy      Decimal @db.Decimal(38, 2)
  taxRate       Decimal             // 10%
  taxAmount     Decimal
  exchangeRate  Decimal             // USD/JPY at issue
  pdfUrl        String?
  emailSent     Boolean
  status        InvoiceStatus       // DRAFT|ISSUED|SENT|PAID|VOIDED
}
```

`ProviderV2` に追加:
- `registrationNumber String?` — T+13桁
- `autoIssueInvoices Boolean @default(false)` — 月末自動発行フラグ

### API
- `POST /api/invoices` — 期間集計 → ExchangeRate-API で JPY 換算 → 10% 消費税 → DRAFT 作成
- `GET /api/invoices?providerV2Id=…&status=…`
- `GET /api/invoices/:id`
- `POST /api/invoices/:id/issue` — DRAFT → ISSUED（不変化）
- `POST /api/invoices/:id/send` — メール送信 stub
- `GET /api/invoices/:id/pdf` — HTML プレビュー（国税庁仕様の必須項目、`@media print` で PDF 化可）

### ダッシュボード
- `/sellers` フォームに T 番号 + 自動発行 toggle 追加
- `PublishPage > 会計連携` タブに `InvoicesPanel` (期間指定で生成、PDF/発行ボタン)

### ファイル
- `api/prisma/schema.prisma` (Invoice model + ProviderV2 拡張)
- `api/src/routes/invoices.ts` (新規 583 行)
- `api/src/routes/providers-v2.ts` (T 番号フィールド追加)
- `dashboard/app/sellers/page.tsx` (T 番号 UI)
- `dashboard/app/page.tsx` (InvoicesPanel)

---

## 3. Task 4: サブスクプラン + 価格 $0.001 化

### 戦略転換
> per-call は x402 と完全同価格 ($0.001) で commodity 化、月額サブスクで真の収益化

### 価格表（最終）
| プラン | 月額 | 含 call | 超過単価 | 機能 |
|---|---|---|---|---|
| **Free** | ¥0 | 1,000 | $0.001 | 基本のみ |
| **Pro** | **¥4,980** | 10,000 | $0.001 | + freee/MF 自動仕訳、適格請求書 |
| **Business** | **¥14,800** | 100,000 | $0.0008 | + JPY オフランプ、複数 wallet、SLA |
| **Enterprise** | 個別 | ∞ | $0.0005 | + 白ラベル、専用サポート |

### Prisma 追加
```prisma
model Subscription {
  providerV2Id          String @unique
  plan                  SubscriptionPlan  // FREE|PRO|BUSINESS|ENTERPRISE
  status                SubscriptionStatus
  stripeCustomerId      String? @unique
  stripeSubscriptionId  String? @unique
  stripePriceId         String?
  currentPeriodStart/End DateTime?
  cancelAtPeriodEnd     Boolean
}
```

### API
- `api/src/lib/plans.ts` — **唯一のプライス source of truth** (PLAN_CONFIG)
- `POST /api/subscriptions/checkout` — Stripe Checkout Session
- `POST /api/subscriptions/portal` — Stripe Customer Portal
- `GET /api/subscriptions/me?providerV2Id=…`
- `POST /api/subscriptions/webhook` — raw-body 署名検証 + upsert

### charges-permit ロジック更新
```typescript
const planCfg = resolvePlanFromName(provider.subscription?.plan ?? "FREE");
const isFree = monthlyCallCount < planCfg.freeCallsPerMonth;
const effectiveAmount = isFree ? "0" : planCfg.overagePerCallUsdc;
```
→ Provider 指定の `amountUsdc` を override してプライス固定。

### Stripe 設定
| Product | Price ID | 月額 |
|---|---|---|
| LemonCake Pro (`prod_UYwrqXFE3T6ZEn`) | `price_1TZpHt2QTtkd8rnyaXRaBpxT` | ¥4,980 |
| LemonCake Business (`prod_UYwrR6iYjr7iCE`) | `price_1TZpI22QTtkd8rnyvMS7XBNh` | ¥14,800 |
| Webhook | `we_1TZozR2QTtkd8rnygkstzH6A` | 4 events |

### ダッシュボード
- `/settings` に `SubscriptionPanel`
- 現プラン + 3 プラン比較 + アップグレード/解約

### ファイル
- `api/prisma/schema.prisma` (Subscription model)
- `api/src/lib/plans.ts` (新規)
- `api/src/routes/subscriptions.ts` (新規 360 行)
- `api/src/routes/charges-permit.ts` (プランベース化)
- `dashboard/app/page.tsx` (SubscriptionPanel)

---

## 4. Task 3: JPY オフランプ（Coincheck）

### 設計原則
**Provider 自身の Coincheck アカウントを経由する** — LemonCake は API key を暗号化保存し、トリガーを引くだけ。取引主体は Provider のまま（非カストディ堅持）。

### Prisma 追加
```prisma
model OfframpConnection {
  providerV2Id      String
  exchange          OfframpExchange  // COINCHECK | BITFLYER | GMO_COIN
  encryptedApiKey   String  // AES-256-GCM
  encryptedApiSecret String
  bankAccountRef    String?
  autoThresholdUsdc Decimal?
  @@unique([providerV2Id, exchange])
}

model OfframpTransaction {
  usdcAmount   Decimal
  jpyReceived  Decimal?
  sellOrderId  String?
  withdrawnJpy Decimal?
  withdrawalId String?
  status       OfframpStatus  // PENDING|USDC_SENT|SOLD|WITHDRAWN|FAILED
}
```

### API
- `POST /api/offramp/coincheck/connect` — API key 登録（疎通テスト → 暗号化保存）
- `GET /api/offramp/coincheck/balance` — JPY/USDC 残高
- `POST /api/offramp/coincheck/sell` — USDC→JPY 成行
- `POST /api/offramp/coincheck/withdraw` — JPY→銀行口座
- `GET /api/offramp/coincheck/transactions` — 履歴

**プラン gate**: Business 以上のみ利用可（`plans.ts` の `jpyOfframp: true`）。

### Coincheck クライアント
- `api/src/lib/coincheck.ts` — HMAC-SHA256 認証、`getBalance` / `marketSellUsdc` / `withdrawJpy`
- `api/src/lib/crypto-aes.ts` — AES-256-GCM at-rest 暗号化（`OFFRAMP_ENCRYPTION_KEY` 必須）

### ダッシュボード
- `/settings` に `OfframpPanel` — 4 ステップ UI (connect → balance → sell → withdraw)
- 履歴テーブル

### ファイル
- `api/prisma/schema.prisma` (OfframpConnection + OfframpTransaction)
- `api/src/lib/coincheck.ts` (新規)
- `api/src/lib/crypto-aes.ts` (新規)
- `api/src/routes/offramp.ts` (新規 350 行)
- `dashboard/app/page.tsx` (OfframpPanel)

---

## 5. Task 5: x402 互換 + Hybrid Facilitator

### v0.1 → v0.2 進化
最初は LemonCake 独自 facilitator のみ。Web 調査の結果、x402 Bazaar 登録は **CDP Facilitator 経由で settle した時だけ** 自動カタログされると判明。AWS Bedrock AgentCore も Bazaar の MCP server を使う。

→ **Hybrid mode** 設計：CDP で settle して Bazaar 載せ、同時に LemonCake にも metering 用 record を投げる。

### `@lemon-cake/x402-server` v0.2.0
```typescript
x402Middleware({
  serviceId: "...",
  facilitator: "lemoncake" | "coinbase" | "both",  // ← NEW
  bazaar: { name, description, category, tags },   // ← NEW
})
```

3 モード：
- **lemoncake** (default): 全部 LemonCake 経由、Pro/Business 機能解禁
- **coinbase**: CDP verify+settle → Bazaar 自動カタログ
- **both**: CDP で settle → 完了後 LemonCake `/api/x402/record` に非同期 POST

### API
- `POST /api/x402/accepts` — Provider serviceId → accepts[] 生成
- `POST /api/x402/verify` — ERC-3009 署名検証 + on-chain 実行
- `POST /api/x402/settle` — `/verify` の別名（仕様準拠）
- `GET /api/x402/supported` — facilitator capability 公開
- `POST /api/x402/record` — hybrid mode で外部 settle 後のメータリング記録（txHash で冪等）

### ERC-3009 実装
`api/src/lib/usdc-base-permit.ts` に追加：
```typescript
export async function executeTransferWithAuthorization({
  from, to, value, validAfter, validBefore, nonce, v, r, s
}: TransferWithAuthorizationParams): Promise<{ txHash: Hex }>
```
spender wallet がガス代を払って relay。

### ファイル
- `api/src/lib/usdc-base-permit.ts` (transferWithAuthorization 追加)
- `api/src/routes/x402.ts` (新規 470 行)
- `x402-server-mcp/` (新規 npm パッケージ、v0.2.0 公開済)

### npm 公開
| Package | Version | URL |
|---|---|---|
| `@lemon-cake/x402-server` | 0.2.0 | https://www.npmjs.com/package/@lemon-cake/x402-server |

---

## 6. /sellers UX 全面リファクタ

### Before
1 ページ長文フォーム、価値訴求弱、価格入力が技術的、成功画面が文字ばかり。

### After (5 ステップウィザード)
1. **Intro** — ヒーロー + 3 柱 value props + Stripe 比較 + プラン teaser
2. **Identity** — 会社名 + Email（最小化）
3. **Wallet** — Base ウォレット + API endpoint（任意）
4. **Pricing** — 6 プリセット chip + **リアルタイム収益シミュレーター**（1k/10k/100k call で ¥/$ 表示）
5. **Tax** — T 番号 + 自動発行 toggle（任意、海外ユーザーはスキップ可）
6. **Review** → submit → **Done** カード式（Service ID/API Key 別色 + show/hide + MCP config 即時生成）

### 抽出した共通コンポーネント
- `dashboard/app/components/ProviderRegistrationWizard.tsx` — `variant: "page" | "embed"` で `/sellers` と PublishPage 内両方で使い回し
- `ProviderGate` — provider 未登録時の共通 CTA カード（SubscriptionPanel / InvoicesPanel / OfframpPanel 全部に挿入）

### ファイル
- `dashboard/app/sellers/page.tsx` (薄いラッパーに）
- `dashboard/app/components/ProviderRegistrationWizard.tsx` (新規 454 行)
- `dashboard/app/page.tsx` (ProviderGate 追加、panel 群を providerV2Id prop-driven に refactor)

---

## 7. 管理者画面 v2 化

### Before
v1 custody 前提の 1,938 行モノリス：buyers管理 / JPYCチャージ審査 / オペレーション監視（all v1 KPI）。

### After
NavSection を `v2 primary` と `legacy (v1)` に分離。

| グループ | 項目 | 中身 |
|---|---|---|
| **v2** | 概要 | MRR / 流通量 / Provider 数 / 今日の課金 |
| | Provider | ProviderV2 一覧 + プラン + 検索/フィルター |
| | サブスク | プラン分布バーチャート + 月貢献額 |
| | アクティビティ | PermitCharge ライブフィード + Basescan tx リンク |
| | インボイス | 全 provider 横断 + PDF 直リンク |
| | オフランプ | OfframpTransaction 履歴（失敗監視） |
| **Legacy** | マーケットプレイス | サービス審査（v1 残存） |
| | 監視 | v1 ログ・リスク |
| | 財務（v1） | 旧 payout / fee |

廃止: Buyer管理、JPYCチャージ審査。

### API
- `api/src/routes/admin-v2.ts` (新規) — read-only listing endpoints
  - `GET /api/admin/v2/stats` — 全 KPI を 1 リクエストで集計
  - `GET /api/admin/v2/providers` — ProviderV2 + subscription
  - `GET /api/admin/v2/charges` — PermitCharge 横断
  - `GET /api/admin/v2/invoices` — Invoice 横断
  - `GET /api/admin/v2/offramp` — Offramp 横断

### ファイル
- `api/src/routes/admin-v2.ts` (新規 280 行)
- `dashboard/app/admin/page.tsx` (NavSection / NAV / Sidebar / Overview 全面置換)
- `api/src/index.ts` (登録順: v2 → /admin の順)

---

## 8. デプロイ復旧（最後の山）

### 症状
Task 1–5 のデプロイが Railway で全部「成功した」ように見えるが、本番には反映されない。最新 deploy ID は変わるのに API は May 20 のイメージを serving。`/api/admin/v2/stats` も `/api/x402/supported` も全部 404。

### 診断プロセス
1. OpenAPI JSON 取得 → 28 paths のみ（v2 routes ゼロ）
2. `railway logs --build` の container digest が `d3a99d72...` で固定 → キャッシュ疑惑
3. Dockerfile に `ARG CACHE_BUST` 追加 → それでも同じ digest
4. `railway status --json` で **`latestDeployment.status` が FAILED** であることを発見
5. `railway logs --deployment <failed-id>` で根本原因判明

### 根本原因
`api/src/lib/secrets.ts:16-23` の `REQUIRED_IN_PRODUCTION` 配列が production で 6 つの env を必須化：
- `HOT_WALLET_PRIVATE_KEY` ✓
- `TREASURY_WALLET_PRIVATE_KEY` ✗ **未設定**
- `JWT_SECRET` ✓
- `ADMIN_JWT_SECRET` ✓
- `INCIDENT_SIGNING_KEY` ✗ **未設定**
- `ACCOUNTING_TOKEN_SECRET` ✓

→ 起動時 `validateSecretsOrThrow()` が throw → process.exit 1 → Railway が直前の健全イメージにロールバック → 古いコードが永続的に serving。

### 対応
```bash
TREASURY_KEY=$(generate fresh viem private key)
INCIDENT_KEY=$(openssl rand -hex 32)
railway variables --set "TREASURY_WALLET_PRIVATE_KEY=$TREASURY_KEY"
railway variables --set "INCIDENT_SIGNING_KEY=$INCIDENT_KEY"
railway up
```
→ 60 秒後 `/api/x402/supported` が 200 OK で返却。全 v2 endpoints 動作確認済み。

### 学び
- Railway deploy status は `railway status --json` の `latestDeployment.status` で必ず確認すべき
- 「container digest が同一」= キャッシュではなく **新デプロイが promote されてない**サイン
- secrets validation は便利だが、CI/dev 環境で同じ check 走らせないと本番でしか気付かない

---

## 9. 環境変数（最終形）

### Railway production (`skillful-blessing`)
```
# 既存 (v1)
HOT_WALLET_PRIVATE_KEY=0x... (v1 hot wallet)
POLYGON_RPC_URL=https://...
DATABASE_URL=postgresql://... (Supabase)
JWT_SECRET / ADMIN_JWT_SECRET / ACCOUNTING_TOKEN_SECRET

# v2 で追加・修正
BASE_SPENDER_PRIVATE_KEY=0xef0b...c25a
BASE_RPC_URL=https://mainnet.base.org
STRIPE_PRICE_PRO=price_1TZpHt2QTtkd8rnyaXRaBpxT
STRIPE_PRICE_BUSINESS=price_1TZpI22QTtkd8rnyvMS7XBNh
STRIPE_SUBSCRIPTION_WEBHOOK_SECRET=whsec_...
OFFRAMP_ENCRYPTION_KEY=<base64 32B>  (AES-256-GCM)
FRONTEND_URL=https://lemoncake.xyz

# デプロイ復旧で追加
TREASURY_WALLET_PRIVATE_KEY=0xcebf...  (生成、validation 用)
INCIDENT_SIGNING_KEY=455476...         (256bit hex)
ALLOW_PRISMA_DB_PUSH_BOOTSTRAP=yes-i-understand  (任意、起動時 db push)
```

### Vercel (`lemon-cake`)
```
NEXT_PUBLIC_PRIVY_APP_ID=cmpflzv8x006y0cl71k5gfn2y
NEXT_PUBLIC_COINBASE_PROJECT_ID=76JepOcpEdXnRfWArr6UV2HoADNMLe6X
NEXT_PUBLIC_TRANSAK_API_KEY=7db8aeda-226a-48e3-bc43-aa024f57a651
NEXT_PUBLIC_API_URL=https://skillful-blessing-production.up.railway.app
```

---

## 10. npm パッケージ最新版

| Package | Version | 役割 |
|---|---|---|
| `agent-payment-mcp` | 0.7.3 / 0.8.0 | バイヤー側 MCP（permit ベース） |
| `@lemon-cake/mcp-sdk` | 0.2.1 | セラー側 SDK |
| `alpaca-guard-mcp` | 0.1.3 | Alpaca trading guard |
| `xstocks-mcp` | 0.1.6 | Solana xStocks |
| `tokenized-stock-mcp` | 0.1.6 | Dinari dShares |
| `polymarket-guard-mcp` | 0.1.1 | Polymarket |
| `@lemon-cake/x402-server` | **0.2.0** | **x402 + hybrid facilitator (NEW)** |

---

## 11. 残作業（外部・手動オペレーション）

### x402 Bazaar 登録
- 専用フォームは存在しない。`facilitator: "coinbase" | "both"` 設定の Provider が CDP 経由で 1 回 settle すれば自動カタログ。
- AWS Bedrock AgentCore は Bazaar の MCP server をそのまま使うので、Bazaar 載れば AWS 経由でも発見される。

### Stripe 旧価格の archive（任意）
- `price_1TZoxh2QTtkd8rnyRUOvKfFR` (旧 Pro ¥2,980)
- `price_1TZoxt2QTtkd8rnyBTCBEihB` (旧 Business ¥9,800)
- Auto mode の denial で archive できなかった → user が dashboard で archive 推奨

### Railway `lemon-cake-dashboard` service
- Railway 上に dashboard 用 service が FAILED 状態で存在（`8b14bda5-eb65-4b87-ae1e-0cff4bd4508e`）
- 本番（Vercel `lemon-cake`）には無関係なので影響なし
- 削除推奨（重複設定）

---

## 12. ARR 想定（修正版）

価格を Pro ¥4,980 / Business ¥14,800 に lift した結果：

```
1,000 paying providers のミックス想定（80/15/4/1）:
  800 Free × ¥0       =      ¥0
  150 Pro  × ¥4,980   = ¥747,000
   40 Bus  × ¥14,800  = ¥592,000
   10 Ent  × ¥80,000  = ¥800,000
  ──────────────────────────────
  Monthly:  ¥2,139,000 = $14,300
  ARR:      $171K
```

前回想定 ($110K ARR) から +55%。Year 3 ($1M ARR) 到達には ~6,000 paying provider 必要。

---

## 13. ファイル一覧（全変更）

### API (Railway)
```
api/prisma/schema.prisma                            (Invoice + Subscription + Offramp* models)
api/src/lib/plans.ts                                NEW (プラン定義)
api/src/lib/coincheck.ts                            NEW (HMAC client)
api/src/lib/crypto-aes.ts                           NEW (AES-256-GCM)
api/src/lib/usdc-base-permit.ts                     (transferWithAuthorization 追加)
api/src/routes/invoices.ts                          NEW
api/src/routes/subscriptions.ts                     NEW
api/src/routes/offramp.ts                           NEW
api/src/routes/x402.ts                              NEW (Task 5 + hybrid /record)
api/src/routes/admin-v2.ts                          NEW
api/src/routes/charges-permit.ts                    (plan-based pricing)
api/src/routes/providers-v2.ts                      (T 番号 / autoIssue)
api/src/index.ts                                    (route 登録、順序調整)
```

### Dashboard (Vercel)
```
dashboard/app/sellers/page.tsx                      (5-step wizard 経由)
dashboard/app/components/ProviderRegistrationWizard.tsx  NEW
dashboard/app/page.tsx                              (SubscriptionPanel / OfframpPanel /
                                                     InvoicesPanel / ProviderGate /
                                                     PublishPage 3-tab)
dashboard/app/admin/page.tsx                        (v2 nav + V2OverviewPage / V2ProvidersPage /
                                                     V2SubscriptionsPage / V2ActivityPage /
                                                     V2InvoicesPage / V2OfframpPage)
```

### npm Package
```
x402-server-mcp/package.json                        NEW (@lemon-cake/x402-server@0.2.0)
x402-server-mcp/src/index.ts                        NEW (hybrid middleware)
x402-server-mcp/README.md                           NEW
```

### ドキュメント
```
docs/SESSION_2026-05-22_v2_completion.md            このファイル
```

---

## 14. 動作確認エンドポイント

```bash
# x402
curl https://skillful-blessing-production.up.railway.app/api/x402/supported
# → {"x402Version":1,"kinds":[{"scheme":"exact","network":"base-mainnet",...}]}

# Admin
curl https://skillful-blessing-production.up.railway.app/api/admin/v2/stats
# → { mrrJpy: 0, providers: {...}, charges: {...}, invoices: {...}, offramp: {...} }

# Sellers ページ
open https://lemoncake.xyz/sellers   # 5-step wizard

# Admin ダッシュボード
open https://lemoncake.xyz/admin     # v2 nav + 全 panel
```

---

## 15. 次回セッション再開方法

```
このリポジトリ /Users/workoutsomehow/adhunt-pro で LemonCake の作業をしています。
まず以下を読んで全文脈を把握してください：

1. docs/SESSION_CONTEXT_2026-05-22.md (Task 1 までの記録)
2. docs/SESSION_2026-05-22_v2_completion.md (Task 1–5 完成 + 価格 + UX + デプロイ復旧、このファイル)
3. docs/HANDOFF_v2_monetization.md (元の Task spec 参照用)

完了タスク: Task 1–5 全部 / 価格 lift (Pro ¥4,980, Business ¥14,800) / /sellers wizard / 管理者 v2

残作業:
- 実 Provider 獲得（PLG 経由）
- x402 Bazaar 登録（CDP facilitator 経由で 1 回 settle するだけ）
- 旧 Stripe price archive
```
