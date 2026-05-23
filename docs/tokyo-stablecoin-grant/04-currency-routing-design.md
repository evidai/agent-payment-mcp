# 通貨ルーティング設計 — Embedded × デュアル通貨

作成日: 2026-05-20
対象: /start/v2 オンボーディング + Dashboard + Provider 受領設定
目的: 日本ユーザーには JPYC、海外ユーザーには USDC を自動でデフォルト化しつつ手動切替も許容する

---

## 1. 設計原則

| 原則 | 内容 |
|---|---|
| **ノンカストディ維持** | LemonCake は USDC/JPYC を一切保管しない。Privy embedded wallet が保管 |
| **Embedded 完結** | 全てのチャージ UX は LemonCake UI 内で完結（外部リダイレクトなし） |
| **明示的な切替** | 自動判定後もユーザーが手動でトグル可能 |
| **Provider 主導** | 最終的な受領通貨は provider が決定可能（locale で hint） |
| **JPY 建て課金の自然さ** | JPYC 選択時は全 UI で円表示（$表示しない） |

---

## 2. アーキテクチャ図

```
┌────────────────────────────────────────────────────────┐
│  /start/v2 (Privy embedded wallet)                      │
│                                                          │
│  Step 0: Locale 自動判定                                 │
│  ├── navigator.language === "ja" || "ja-JP"             │
│  ├── IP geolocation (fallback) === "JP"                 │
│  └── → Default: JPYC                                    │
│      他: USDC                                           │
│                                                          │
│  Step 1: ログイン (Privy)                                │
│  └── Email / Google / Wallet（共通）                     │
│                                                          │
│  Step 2: 通貨選択トグル                                  │
│  ┌──────────────────────────────────────┐               │
│  │  💴 JPYC (Polygon)  │  💵 USDC (Base) │               │
│  └──────────────────────────────────────┘               │
│  ├── デフォルト値: Step 0 で決定                         │
│  └── ユーザーが手動で切替可能                            │
│                                                          │
│  Step 3: Chargeモーダル (currency に応じて分岐)          │
│  ├── [JPYC] → JPYC EX API + LemonCake カスタム UI       │
│  │           ├── 銀行振込: 口座番号生成 + polling       │
│  │           └── クレカ: 入力フォーム + 決済            │
│  └── [USDC] → Coinbase Onramp SDK (iframe)              │
│              ├── Apple Pay → USDC                       │
│              └── Card → USDC                            │
│                                                          │
│  Step 4: Permit 90日署名 (Privy signTypedData)           │
│  └── 通貨ごとの EIP-712 ドメイン                         │
│      ├── JPYC: { name: "JPY Coin", chainId: 137, ... }  │
│      └── USDC: { name: "USD Coin", chainId: 8453, ... } │
│                                                          │
│  → LEMON_CAKE_PERMIT JWT 発行                            │
│    payload: {                                            │
│      currency: "JPYC" | "USDC",                          │
│      chainId: 137 | 8453,                                │
│      token: "0xE7C3..." | "0x833589...",                 │
│      spender: "0x...",                                   │
│      maxAmount: "...",                                   │
│      deadline: ...                                       │
│    }                                                     │
└────────────────────────────────────────────────────────┘
```

---

## 3. Locale 自動判定ロジック

### 判定順序（優先度高 → 低）

```typescript
// /lib/locale-detector.ts
export type DefaultCurrency = "JPYC" | "USDC";

export function detectDefaultCurrency(): DefaultCurrency {
  // 1. ユーザーの明示的な過去選択（localStorage / DB）
  const userPref = getUserCurrencyPreference();
  if (userPref) return userPref;

  // 2. URL クエリパラメータ（外部リンクからの誘導）
  const queryParam = new URLSearchParams(location.search).get("currency");
  if (queryParam === "JPYC" || queryParam === "USDC") return queryParam;

  // 3. Provider 推奨通貨（決済先プロバイダが指定）
  const providerHint = getProviderCurrencyHint();
  if (providerHint) return providerHint;

  // 4. ブラウザ locale
  const lang = navigator.language || "en";
  if (lang.startsWith("ja")) return "JPYC";

  // 5. IP geolocation (server-side)
  // → JP なら JPYC、それ以外 USDC
  // (cf. Cloudflare CF-IPCountry header / Vercel geolocation)

  // 6. 最終 fallback
  return "USDC";
}
```

### サーバーサイド検出（Vercel Edge）

```typescript
// /app/start/v2/page.tsx (server component)
import { geolocation } from "@vercel/functions";

export default function StartV2({ headers }) {
  const { country } = geolocation({ headers });
  const initialCurrency = country === "JP" ? "JPYC" : "USDC";
  return <StartV2Client initialCurrency={initialCurrency} />;
}
```

---

## 4. UI: 通貨切替トグル

### デザイン
```
┌──────────────────────────────────────────────┐
│           Choose your currency                │
│                                                │
│   ┌──────────────┐  ┌──────────────┐         │
│   │ 💴            │  │ 💵            │         │
│   │ JPYC          │  │ USDC          │         │
│   │ 日本円        │  │ US Dollar     │         │
│   │ Polygon       │  │ Base          │         │
│   │ ✓ Default     │  │               │         │
│   └──────────────┘  └──────────────┘         │
│                                                │
│   (Recommended for Japan based on your locale) │
└──────────────────────────────────────────────┘
```

### 動作
- クリックで即時切替（モーダル遷移なし）
- 選択が localStorage に保存される（再訪時に維持）
- 各通貨の bullet point:
  - JPYC: 「為替リスクなし・JPYC EX で1分でチャージ・電子マネー扱い（税務簡素）」
  - USDC: 「Apple Pay でチャージ・グローバル対応・7ヶ国規制クリア」

---

## 5. Provider 側の受領通貨設定

Provider（API/サービス提供者）のダッシュボードで:

```
┌──────────────────────────────────────────────────────┐
│  Provider Settings: Payment Receiving                 │
│                                                        │
│  Receiving Wallet Address:                            │
│  [ 0x...                                          ]   │
│                                                        │
│  Accepted Currencies (multi-select):                  │
│  [✓] USDC (Base)                                      │
│  [✓] JPYC (Polygon)                                   │
│                                                        │
│  Auto-conversion (Phase 2):                           │
│  [ ] Auto-convert all incoming to: ▼ JPYC ▼          │
│                                                        │
│  Pricing per call:                                    │
│  USDC: $0.005 - $0.01                                 │
│  JPYC: ¥0.5 - ¥1                                      │
│                                                        │
└──────────────────────────────────────────────────────┘
```

Provider が **両方受領可** にしている場合:
- 日本ユーザー → JPYC で支払う（円建てで仕訳）
- 海外ユーザー → USDC で支払う（ドル建てで仕訳）
- Provider の会計負担なし（為替なし）

---

## 6. Pay Token JWT スキーマ拡張

```json
{
  "iss": "lemoncake.xyz",
  "sub": "user_wallet_address",
  "aud": "provider_id",
  "exp": 1735689600,
  "iat": 1727913600,
  "scope": "api:call",
  
  "currency": "JPYC",          // ← 新規追加
  "chainId": 137,              // ← 新規追加
  "token": "0xE7C3D8C9...",    // ← 新規追加
  "spender": "0x...",          // 既存
  "maxAmount": "1000000000000000000000",  // 1000 JPYC (decimals=18)
  "permitDeadline": 1735689600,
  
  "providerWallet": "0x..."    // ← Provider 受領アドレス
}
```

- `currency` フィールドで支払い通貨を明示
- Spender コントラクトは currency に応じて適切な ERC-20 contract に対して `transferFrom` を呼ぶ
- メータリングは currency 単位で集計

---

## 7. Embedded Chargeモーダルの分岐

### JPYC モーダル（新規実装）
```
┌─────────────────────────────────────────────┐
│         💴 JPYC をチャージ                   │
│                                              │
│  金額:  [¥1,000] [¥5,000] [¥10,000] [カスタム] │
│                                              │
│  支払い方法:                                  │
│  ○ 銀行振込 (推奨・即時)                      │
│  ○ クレジットカード                          │
│                                              │
│  ----------- 銀行振込の場合 -----------       │
│  振込先銀行: GMOあおぞらネット銀行            │
│  支店名: XXX                                 │
│  口座番号: 1234567 (LemonCake 専用)          │
│  振込人名: SATO HIROTO                       │
│                                              │
│  [振込完了したらクリック] → 着金 polling 開始 │
│                                              │
│  ----------- クレカの場合 ------------        │
│  [カード情報入力] → 即時 JPYC 着金            │
│                                              │
│  着金後: Privy wallet に自動反映 → permit へ  │
└─────────────────────────────────────────────┘
```

### USDC モーダル（既存）
- Coinbase Onramp SDK の FundButton をモーダル内に embed
- Apple Pay → USDC が iframe で完結

---

## 8. 実装タスク分解

### 即着手可能（Phase 1）
- [ ] `lib/locale-detector.ts` 実装
- [ ] `/start/v2` に currency state 追加（既存の Privy フローを拡張）
- [ ] Privy config に Polygon chain 追加（既存 Base のみから）
- [ ] EIP-712 domain を currency 別に生成する helper
- [ ] Pay Token JWT に currency/chainId/token 追加

### JPYC EX API 統合後（Phase 1 後半）
- [ ] JPYC Charge Modal コンポーネント新規実装
- [ ] 銀行振込先生成 API 連携
- [ ] 着金 webhook ハンドラ + polling fallback
- [ ] クレカ決済 API 連携（JPYC EX がサポートする場合）

### メータリング DB 拡張（Phase 2）
- [ ] `transactions` テーブルに `currency`, `amountRaw`, `chainId` カラム追加
- [ ] Provider ダッシュボードに通貨別売上集計
- [ ] freee/MF 仕訳連携を currency 別に分岐

---

## 9. テスト計画

### 単体テスト
- locale 判定の網羅（ja-JP / ja / en-US / en-GB / IP=JP / IP=US 等）
- localStorage 永続化
- Provider hint 優先

### E2E テスト
- 日本 IP からアクセス → JPYC default
- 米国 VPN 経由 → USDC default
- 手動切替 → localStorage 保存 → 再訪時に維持

### 実機テスト
- iPhone Safari (Japan) → JPYC モーダル動作
- Chrome (Japan) → 同上
- Coinbase Onramp SDK iframe の動作確認（USDC 側）

---

## 10. リスク・要検証

| リスク | 対処 |
|---|---|
| Provider が JPYC を受け取らない | デフォルトで USDC fallback、ユーザーに通知 |
| 為替換算が必要なケース（混在）| Phase 2 で auto-conversion 機能、まずは「両方並列受領」のみ |
| JPYC EX API がクレカ非対応 | クレカは Phase 1 では銀行振込のみ、クレカは Phase 2 |
| Privy が JPYC token 表示非対応 | カスタム balance fetcher を実装、Privy SDK を拡張 |
| Spender contract が両通貨対応 | spender を currency 別に分けるか、ファクトリーパターンで |

---

## 11. ロールアウト計画

### Day 1（採択発表後すぐ）
- Privy に Polygon chain 追加
- /start/v2 に currency state 導入（USDC のみで動作テスト）

### Week 2-4
- locale 判定実装
- 通貨切替トグル UI

### Month 2-3
- JPYC Charge Modal 実装（バックエンド + フロント）
- JPYC EX API 統合

### Month 3-4
- Beta テスト（社内 + 早期パートナー 3社）
- Provider ダッシュボード JPYC 対応

### Month 4-5
- 一般公開
- ドキュメント整備

### Month 6-9
- 都内中小 SaaS 3社で実証実験
- 補助金成果報告データ収集
