# LemonCake v2 マネタイズ実装 — 引き継ぎ指示書

**作成日**: 2026-05-22  
**対象セッション**: 別 Claude Code / Cursor / 別エンジニア  
**前提**: このリポジトリのコンテキストはゼロ前提で説明する

---

## 0. 30秒サマリー

LemonCake は AI エージェント / MCP サーバー向けの非カストディ USDC マイクロペイメント決済インフラ。
v2 で ERC-2612 permit ベース（90日有効）に移行済み、`/start/v2` 本番動作中、5 npm パッケージ公開済。

**今回のミッション**: マネタイズの軸を「per-call 手数料のみ」から「**サブスク × 日本ビジネス特化機能**」に転換する。同時に x402 互換を実装してグローバル流量を呼ぶ。

**戦略の核**:
- Per-call は x402 と完全同価格（**$0.001/call**）→ 価格を購買決定から外す
- 真の収益源は **freee/MF 自動仕訳・インボイス・JPY オフランプ** をサブスクで売る
- x402 互換にして Coinbase / Stripe / Visa 配給網に乗る

**5 タスクを以下の順で実行する**：
1. 会計連携復活（freee/MF）
2. インボイス発行機能
3. JPY オフランプ（Coincheck/bitFlyer API）
4. サブスクプラン UI + 価格を $0.001 に
5. x402 互換実装

---

## 1. リポジトリ構造

```
/Users/workoutsomehow/adhunt-pro/
├── dashboard/                 # Next.js App Router（lemoncake.xyz、Vercel）
│   ├── app/
│   │   ├── page.tsx          # メインダッシュボード（4,200行・モノリス）
│   │   ├── start/v2/page.tsx # 非カストディオンボーディング（本番動作中）
│   │   ├── sellers/page.tsx  # Provider 登録ページ（先日追加）
│   │   └── ...
│   └── .env.local            # ローカル envs
├── api/                       # Hono API サーバー（Railway）
│   ├── src/
│   │   ├── index.ts          # エントリポイント、ルーター登録
│   │   ├── routes/
│   │   │   ├── charges-permit.ts   # v2 permit ベース課金
│   │   │   ├── providers-v2.ts     # v2 provider 登録
│   │   │   ├── accounting.ts       # 既存の freee/MF 連携（生きてる）
│   │   │   └── ...
│   │   └── lib/
│   │       ├── usdc-base-permit.ts # Base 上の permit + transferFrom
│   │       ├── prisma.ts
│   │       └── ...
│   └── prisma/schema.prisma  # PostgreSQL on Supabase
├── agent-payment-mcp/        # メイン MCP パッケージ
└── docs/                     # このファイル
```

**API 本番 URL**: `https://skillful-blessing-production.up.railway.app`  
**ダッシュボード本番 URL**: `https://lemoncake.xyz`  
**DB**: Supabase PostgreSQL（`postgres@aws-1-ap-northeast-1.pooler.supabase.com:5432`）

---

## 2. デプロイ方法

| 対象 | 方法 |
|---|---|
| Dashboard | `git push origin main` → Vercel auto-deploy |
| API | `cd api && railway up --detach` → Railway 上書き |
| Prisma スキーマ変更 | `cd api && npx prisma db push`（migrate dev はシャドー DB エラーで使えない） |

**Railway env 既存**:
- `BASE_SPENDER_PRIVATE_KEY` = `0xef0b01da08d83786ac7526978ba35ad1ca1dc47cdb6b5bb911cebdafd348c25a`
- `BASE_RPC_URL` = `https://mainnet.base.org`
- `HOT_WALLET_PRIVATE_KEY`, `POLYGON_RPC_URL` 等（v1 用、変更不要）

---

## 3. タスク 1: 会計連携復活（freee / MoneyForward）

### 状況

`AccountingPage` コンポーネント（`dashboard/app/page.tsx:3340`）は**コードとして生きてる**が、サイドバーから外れているだけ。同様に API 側 `api/src/routes/accounting.ts` も稼働中。

### ゴール

新しい v2 ダッシュボード（`overview / permits / usage / marketplace / publish / settings`）に**「publish」セクションの中のサブタブ**として復活させる。理由：
- Provider が USDC で収益を受け取った場合、それを freee/MF に自動仕訳したい
- これは Pro プラン以上の有料機能になる

### 実装手順

#### 3.1 Page 型に新タブを追加しない

サイドバーは増やさない。代わりに `publish` ページ内に **タブ切り替え** を追加：

```tsx
// dashboard/app/page.tsx 内、PublishPage を新規作成
function PublishPage({ ... }) {
  const [tab, setTab] = useState<"services" | "revenue" | "accounting">("services");
  return (
    <>
      {/* タブヘッダー */}
      <div className="border-b mb-6">
        <button onClick={() => setTab("services")}>マイサービス</button>
        <button onClick={() => setTab("revenue")}>売上統計</button>
        <button onClick={() => setTab("accounting")}>会計連携</button>
      </div>
      {tab === "services" && <SellerServicesPage ... />}
      {tab === "revenue" && <SellerStatsPage services={myServices} />}
      {tab === "accounting" && <AccountingPage buyerToken={buyerToken} />}
    </>
  );
}
```

#### 3.2 ルーティング更新

`dashboard/app/page.tsx:4135` 周辺の `{page === "publish" && ...}` 部分を `PublishPage` 呼び出しに変更。

#### 3.3 acceptance criteria

- [ ] `/` のサイドバーから「Publish API」をクリック → 3 タブ表示される
- [ ] 「会計連携」タブで freee / MF / QuickBooks / Xero / Zoho / Sage の OAuth ボタンが出る
- [ ] OAuth 既接続のものは「接続済み」バッジが出る

#### 3.4 注意点

- `AccountingPage` は `buyerToken` を要求する → 既存の auth フローから受け取って渡す
- `useT()` と `LangContext` を使うので、`PublishPage` 内でもそのまま動くはず

---

## 4. タスク 2: インボイス発行機能

### ゴール

USDC で受け取った課金を、**日本の適格請求書（インボイス制度準拠）として自動発行**する。

### 実装手順

#### 4.1 Prisma スキーマ追加

`api/prisma/schema.prisma` に追加：

```prisma
model Invoice {
  id String @id @default(cuid())

  // 発行元（Provider v2 = LemonCake に登録した提供者）
  providerV2Id String
  providerV2   ProviderV2 @relation(fields: [providerV2Id], references: [id])

  // 適格請求書発行事業者登録番号（T + 13桁）
  registrationNumber String

  // 請求先（permit owner address）
  buyerAddress String
  buyerName    String?
  buyerEmail   String?

  // 内訳
  periodFrom DateTime
  periodTo   DateTime
  callCount  Int
  totalUsdc  Decimal @db.Decimal(38, 18)
  totalJpy   Decimal @db.Decimal(38, 2)   // USDC → JPY 換算（発行時レート）
  taxRate    Decimal @db.Decimal(5, 2)    // 10.00 = 10%
  taxAmount  Decimal @db.Decimal(38, 2)
  exchangeRate Decimal @db.Decimal(20, 10) // USD/JPY at issue time

  // PDF / メール送信
  pdfUrl      String?
  emailSent   Boolean @default(false)

  status InvoiceStatus @default(DRAFT)

  issuedAt DateTime @default(now())

  @@index([providerV2Id, issuedAt])
  @@map("invoices")
}

enum InvoiceStatus {
  DRAFT
  ISSUED
  SENT
  PAID
  VOIDED
}
```

`providerV2` モデルにも `registrationNumber String?` を追加（適格請求書発行事業者登録番号）。

実行: `cd api && npx prisma db push`

#### 4.2 API ルート

`api/src/routes/invoices.ts` を新規作成：

```typescript
// POST /api/invoices         - 期間指定でインボイス自動生成
// GET  /api/invoices         - 一覧取得
// GET  /api/invoices/:id     - 単体取得（PDF URL 含む）
// POST /api/invoices/:id/send - メール送信
```

PDF 生成は **puppeteer** か **@react-pdf/renderer** を使用。ストレージは Supabase Storage か S3。

#### 4.3 適格請求書の必須項目（国税庁仕様）

- 発行者氏名/法人名 + 登録番号（T+13桁）
- 取引年月日
- 取引内容
- 税率ごとに区分した対価の額
- 消費税額
- 書類交付を受ける事業者の氏名/名称

#### 4.4 ダッシュボード UI

`/publish` の「会計連携」タブの下に「インボイス発行」サブセクション追加。月次の自動発行 toggle。

#### 4.5 acceptance criteria

- [ ] Provider 登録時に「登録番号 T1234567890123」を入力できる
- [ ] 月末 cron で前月分のインボイス自動生成
- [ ] PDF ダウンロードボタンが動く
- [ ] freee / MF への自動取り込み（既存 OAuth 連携経由）

---

## 5. タスク 3: JPY オフランプ（Coincheck / bitFlyer API）

### ゴール

Provider が受け取った USDC を、**「ボタン1つで日本円にして、登録した法人銀行口座に着金させる**」体験を提供する。

### 実装手順

#### 5.1 API 選定

| 候補 | 利点 | 欠点 |
|---|---|---|
| **Coincheck for Business** | USDC 取扱、JPY 出金、API ドキュメント公開 | KYB 必須、API 公開度はそこそこ |
| **bitFlyer** | 老舗、API 安定、JPY 出金 | USDC 取扱なし → USDT 経由必要 |
| **GMO コイン** | 法人向け API 充実 | USDC 取扱開始最近 |

**推奨**: Coincheck（USDC 直接対応） + bitFlyer（バックアップ）

#### 5.2 必要な統合

1. **LemonCake → 取引所デポジット**: Provider の受取ウォレット → Coincheck の Provider 個別アドレスへ USDC 送金
2. **取引所内で USDC → JPY**: Coincheck の trade API
3. **JPY → 銀行口座**: Coincheck の withdraw API

これは **Provider 側の取引所アカウント** を経由する必要がある（LemonCake 自身は預からない＝ 非カストディ堅持）。

#### 5.3 アーキテクチャ

```
1. Provider が /publish > 設定 で Coincheck API key を入力
   （Coincheck の API key は read/trade/withdraw 権限）

2. LemonCake は API key を暗号化して保存（KMS 推奨）

3. Provider が「JPY に変換」ボタンを押す
   → LemonCake は (a) Coincheck の入金アドレスを取得
   → (b) Provider のウォレットから USDC を送金（Provider 自身が permit/署名）
   → (c) Coincheck の market sell（USDC→JPY）を発行
   → (d) Coincheck の withdraw（JPY→銀行口座）を発行

4. 進捗を WebSocket で表示
```

**重要**: Provider が「permit 署名 1 回」で全部実行できる UX を目指す。

#### 5.4 API ルート

```
POST /api/offramp/coincheck/connect    - Coincheck API key 登録
GET  /api/offramp/coincheck/balance    - Provider の Coincheck 残高
POST /api/offramp/coincheck/sell       - USDC → JPY market sell
POST /api/offramp/coincheck/withdraw   - JPY → 銀行口座
GET  /api/offramp/transactions         - 履歴
```

#### 5.5 acceptance criteria

- [ ] Provider が `/publish > 設定 > オフランプ` で Coincheck 連携できる
- [ ] テストモード（API key の paper trading）で動作確認
- [ ] 実環境で 100 USDC → 約 ¥15,000 → 銀行口座着金まで完走

---

## 6. タスク 4: サブスクプラン UI（Stripe Billing）+ 価格を $0.001 に変更

### ゴール

Per-call の単価を **x402 と同じ $0.001/call** に変更し、**サブスクプランの月額固定費** で稼ぐ構造にする。

### 価格モデル

| プラン | 月額 | 含まれる call | 超過単価 | 主要機能 |
|---|---|---|---|---|
| **Free** | ¥0 | 1,000 | ¥0.15/call（≒$0.001） | 基本機能のみ |
| **Pro** | **¥2,980** | **10,000** | ¥0.15/call | + freee/MF 自動仕訳<br>+ インボイス自動発行<br>+ 分析ダッシュボード |
| **Business** | **¥9,800** | **100,000** | ¥0.10/call（量割引） | + JPY 自動オフランプ<br>+ 複数ウォレット<br>+ SLA 99.9% |
| **Enterprise** | 個別 | 個別 | 個別 | + 専用サポート / 監査ログ / 白ラベル |

### 実装手順

#### 6.1 Prisma スキーマ追加

```prisma
model Subscription {
  id String @id @default(cuid())

  providerV2Id String @unique
  providerV2   ProviderV2 @relation(fields: [providerV2Id], references: [id])

  plan SubscriptionPlan @default(FREE)

  // Stripe 連携
  stripeCustomerId      String? @unique
  stripeSubscriptionId  String? @unique
  stripePriceId         String?

  status SubscriptionStatus @default(ACTIVE)

  currentPeriodStart DateTime?
  currentPeriodEnd   DateTime?
  cancelAtPeriodEnd  Boolean @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum SubscriptionPlan {
  FREE
  PRO
  BUSINESS
  ENTERPRISE
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELED
  TRIALING
}
```

`ProviderV2.freeCallsPerMonth` も plan に応じて変動させる（Free=1000, Pro=10000, Business=100000）。

#### 6.2 Stripe 設定

Stripe ダッシュボードで以下の Price を作成：
- LemonCake Pro: ¥2,980 / month (recurring)
- LemonCake Business: ¥9,800 / month (recurring)

Price ID を env に：
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_BUSINESS=price_xxx
STRIPE_WEBHOOK_SECRET=whsec_...
```

#### 6.3 API ルート

```
POST /api/subscriptions/checkout        - Stripe Checkout Session 発行
POST /api/subscriptions/portal          - Stripe Customer Portal
POST /api/subscriptions/webhook         - Stripe Webhook (invoice.paid 等)
GET  /api/subscriptions/me              - 自分の subscription 状態
```

#### 6.4 ダッシュボード UI

`/settings` に「プラン」タブ追加：
- 現プラン表示
- アップグレード/ダウングレードボタン → Stripe Checkout
- 「請求書一覧」リンク → Stripe Portal

#### 6.5 charges-permit.ts の更新

`api/src/routes/charges-permit.ts` の価格判定を変更：

```typescript
// 現在
const effectiveAmount = isFree ? "0" : amountUsdc;

// 変更後
const subscription = await prisma.subscription.findUnique({
  where: { providerV2Id: serviceId },
});
const planLimits = {
  FREE:       { quota: 1000,   overage: "0.001" },
  PRO:        { quota: 10000,  overage: "0.001" },
  BUSINESS:   { quota: 100000, overage: "0.0008" },
  ENTERPRISE: { quota: Infinity, overage: "0.0005" },
};
const plan = subscription?.plan ?? "FREE";
const { quota, overage } = planLimits[plan];

const isFree = monthlyCallCount < quota;
const effectiveAmount = isFree ? "0" : overage;
```

#### 6.6 acceptance criteria

- [ ] `/settings > プラン` で現プラン表示
- [ ] 「Pro にアップグレード」→ Stripe Checkout → 完了後 plan が PRO に
- [ ] Pro 加入後、freee/MF 連携機能がアンロックされる
- [ ] Per-call 課金が $0.001/call で動く
- [ ] Stripe Customer Portal から解約できる

---

## 7. タスク 5: x402 互換実装

### ゴール

LemonCake を **HTTP 402 Payment Required** プロトコル（Coinbase 主導の OSS 標準）に互換させる。これにより：
- AWS Bedrock AgentCore、Coinbase Bazaar、Stripe Agentic Suite 経由で LemonCake provider が発見される
- 22 社の Foundation メンバー経由の配給網に乗る

### 仕様

x402 公式仕様: https://www.x402.org/  
Coinbase 実装: https://docs.cdp.coinbase.com/x402/welcome

#### 7.1 サーバー側（Provider が立てる API）

Provider の API は、未払いリクエストに対して以下のレスポンスを返す：

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json
X-Payment-Required: 1

{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "base-mainnet",
      "maxAmountRequired": "1000",     // micro-USDC (6 decimals) = $0.001
      "resource": "https://provider.example/api/search",
      "description": "Web search API call",
      "mimeType": "application/json",
      "payTo": "0x23e0D435b62d8eABE2b239c461Ec6fb2E8B7E965",  // LemonCake spender
      "maxTimeoutSeconds": 60,
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC
      "extra": {
        "name": "USDC",
        "version": "2"
      }
    }
  ]
}
```

#### 7.2 クライアント側（agent-payment-mcp）

エージェントが 402 を受け取ったら：
1. `accepts[0]` の中から最安のものを選ぶ
2. ERC-3009 `transferWithAuthorization` を署名（or permit）
3. 再リクエストに `X-PAYMENT` ヘッダで署名 base64 を載せる
4. サーバーが署名検証 → 200 OK + データ返却

#### 7.3 LemonCake 実装

##### 7.3.1 Provider 側ミドルウェア

`@lemoncake/x402-server` という新 npm パッケージを作る：

```typescript
import { x402Middleware } from "@lemoncake/x402-server";

app.use("/api/search", x402Middleware({
  serviceId: "your-service-id",
  pricePerCallUsd: 0.001,
  lemonCakeApiUrl: "https://skillful-blessing-production.up.railway.app",
}));
```

中身：
1. リクエストに `X-PAYMENT` ヘッダがなければ 402 + accepts を返す
2. ヘッダがあれば LemonCake API に検証リクエスト送る
3. 検証 OK なら `next()`、NG なら 402 再送

##### 7.3.2 LemonCake API 側

`POST /api/x402/verify` を追加：

```typescript
// body: { paymentHeader: string, accepts: AcceptItem }
// → 署名検証 + on-chain transferWithAuthorization 実行
// → { ok: true, txHash: "0x..." } または { ok: false, reason: "..." }
```

`api/src/lib/usdc-base-permit.ts` の `executePermitTransfer` を、ERC-3009 にも対応させる（`transferWithAuthorization` メソッド追加）。

##### 7.3.3 Discovery 登録

x402 Bazaar に LemonCake を Facilitator として登録：
- https://www.x402.org/ → Submit Facilitator
- Coinbase Bazaar API: https://docs.cdp.coinbase.com/x402/bazaar

#### 7.4 マーケティング変更

- LP の見出しを「**Non-custodial x402 for MCP**」に
- README に「x402-compatible」バッジ追加
- Twitter / Reddit / Hacker News で「x402 + MCP + Japan」で初期告知

#### 7.5 acceptance criteria

- [ ] `npm install @lemoncake/x402-server` で 1 行ミドルウェア追加できる
- [ ] curl で 402 → 署名 → 200 のフローが動く
- [ ] x402 Bazaar の facilitator リストに掲載される
- [ ] Coinbase の x402 公式 example client から LemonCake provider に接続できる

---

## 8. 実行順序

```
Week 1
├─ Task 1: 会計連携復活      (0.5 day)
├─ Task 2: インボイス機能    (2 day) ← Prisma schema 変更含む
└─ Task 4: サブスク UI 骨組み (2 day) ← Stripe 連携セットアップ

Week 2  
├─ Task 4 続き: 価格を $0.001 に   (1 day)
├─ Task 4 続き: Free/Pro/Business UI (2 day)
└─ Task 3: JPY オフランプ MVP    (2 day) ← Coincheck だけ先

Week 3-4
└─ Task 5: x402 互換実装       (1-2 week)
   ├─ @lemoncake/x402-server パッケージ
   ├─ /api/x402/verify ルート
   ├─ usdc-base-permit.ts に ERC-3009 追加
   └─ Bazaar 登録 + マーケ
```

**合計: 約 4 週間（1 人月）**

---

## 9. 開発フロー

### コミット粒度

タスク 1 単位ではなく、**サブタスク単位で小さくコミット**。例：

```
feat(dashboard): re-wire AccountingPage as Publish tab     ← Task 1
feat(api): add Invoice prisma model                        ← Task 2-a
feat(api): POST /api/invoices route                        ← Task 2-b
feat(dashboard): invoice list UI in Publish > Accounting   ← Task 2-c
```

### コミットメッセージ規約

- prefix: `feat / fix / refactor / chore / docs`
- 末尾: `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`

### ブランチ

main 直 push で OK。Vercel/Railway が自動デプロイ。  
大規模な破壊変更（Task 5 の x402 含む）だけ feature branch + PR。

### テスト

- API 側: Vitest（既存）
- Prisma migrate: `npx prisma db push`（migrate dev は使わない、シャドー DB エラー）
- E2E: 本番デプロイ前に curl で叩く

---

## 10. 注意点 / 落とし穴

### 10.1 Prisma migrate dev は動かない

シャドー DB エラーで失敗する。**必ず `npx prisma db push` を使う**。

### 10.2 Hono OpenAPI の型エラー

新ルート追加時、Hono OpenAPI が response 型を厳格にチェックして TS エラーを出すことがある。回避策：

```typescript
async (c: any) => { ... }  // eslint-disable-next-line
```

既存の charges-permit.ts / providers-v2.ts でこのパターン使ってる。

### 10.3 Vercel と Railway のデプロイ順

Dashboard → API の順でデプロイすると API が無い時間に UI が壊れる。
**API 先、Dashboard 後の順で push する**。

### 10.4 ルート登録の前置一致問題

Hono は prefix-match で登録順に評価する。新ルートを追加するときは、より具体的なパスを先に：

```typescript
app.route("/api/x402",          x402Router);          // ✅ 先
app.route("/api/charges/permit", chargesPermitRouter); // ✅ 先
app.route("/api/charges",       chargeRouter);        // ✅ 後
```

### 10.5 環境変数

新規追加する env はすべて：
1. `.env.local`（dashboard）or `.env`（api）に追加
2. `vercel env add` で Vercel に追加
3. `railway variables set` で Railway に追加
4. README に記載

---

## 11. 参考リンク

- LemonCake LP: https://lemoncake.xyz
- v2 onboarding: https://lemoncake.xyz/start/v2
- Privy dashboard: https://dashboard.privy.io/apps/cmpflzv8x006y0cl71k5gfn2y
- Coinbase CDP: https://portal.cdp.coinbase.com
- Supabase: project dashboard 経由
- npm: https://www.npmjs.com/~evidai_lemoncake

### 外部仕様書

- x402: https://www.x402.org/
- Coinbase x402 docs: https://docs.cdp.coinbase.com/x402/welcome
- ERC-2612 permit: https://eips.ethereum.org/EIPS/eip-2612
- ERC-3009: https://eips.ethereum.org/EIPS/eip-3009
- 適格請求書: https://www.nta.go.jp/taxes/shiraberu/zeimokubetsu/shohi/keigenzeiritsu/invoice.htm
- Coincheck API: https://coincheck.com/documents/exchange/api
- bitFlyer API: https://lightning.bitflyer.com/docs

### 戦略コンテキスト

このリポジトリ内 `~/.claude/projects/-Users-workoutsomehow-adhunt-pro/memory/project_v2_launch_2026-05-22.md` に v2 launch の全文記録あり。マネタイズ判断の背景はそこに。

---

## 12. 完了判定

全タスク完了時の状態：

- [ ] `/sellers` 経由で provider 登録 → 1分以内に MCP に組み込める
- [ ] Pro プラン加入で freee 自動仕訳が動く
- [ ] Business プラン加入で USDC → JPY 自動換金 + 銀行着金
- [ ] インボイス（適格請求書）が月次で自動発行される
- [ ] 任意の x402 クライアント（Coinbase 公式 example）から LemonCake provider に接続して支払いが完走
- [ ] LemonCake のサブスク MRR が ¥100K（年 ¥1.2M、約 $8K ARR）を超える

---

**疑問点があれば**: contact@aievid.com  
**口頭メモ**: x402 は会社じゃなく規格。LemonCake は「最軽量・非カストディ・MCP特化・日本ローカライズ」を堀にする。Circle/Stripe と価格競争はしない。
