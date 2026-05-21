# External keys setup — Privy / Stripe Crypto / Pimlico

このドキュメントに従って 3 つの外部サービスの App ID / API キーを
取得し、Vercel の環境変数に設定すれば、`/start/v2` の永続オンラインが
完成します。

それまでは：
- `/start/v2` はモック署名で動作（UI は確認できる）
- `<PrivyProvider>` は `NEXT_PUBLIC_PRIVY_APP_ID` が未設定なら no-op
- Stripe / Pimlico も同様にフォールバック

---

## 1. Privy（10分・必須・無料）

最も重要。これがないと実署名フローが動かない。

### 取得手順

1. https://dashboard.privy.io にアクセス
2. **「Sign up」** → Google / GitHub でアカウント作成
3. **「Create new app」** → アプリ名「LemonCake」
4. **App ID** をコピー（`clxxxxxxxx` 形式の文字列）
5. **App settings → Login methods** で以下を有効化：
   - Google
   - Email
   - Wallet (MetaMask / WalletConnect)
6. **App settings → Embedded wallets** で：
   - "Create on login: users-without-wallets" を選択
   - Chains: Base (8453) を追加
7. **App settings → Allowed domains** で：
   - `https://lemoncake.xyz`
   - `https://*.vercel.app`（preview デプロイ用）
   - `http://localhost:3000`（dev 用）

### Vercel への設定

```bash
echo "<コピーした App ID>" | vercel env add NEXT_PUBLIC_PRIVY_APP_ID production
echo "<同じ App ID>"      | vercel env add NEXT_PUBLIC_PRIVY_APP_ID preview
echo "<同じ App ID>"      | vercel env add NEXT_PUBLIC_PRIVY_APP_ID development
```

または Vercel ダッシュボード → Settings → Environment Variables から
GUI で：
- Key: `NEXT_PUBLIC_PRIVY_APP_ID`
- Value: `clxxxxxxxx...`
- Environments: Production / Preview / Development

### 反映

```bash
cd dashboard
vercel deploy --prod
```

→ `/start/v2` 上部の「⚠️ Privy App ID 未設定」バナーが消えれば成功。
Google ログインボタンが実際に Privy 認証モーダルを開きます。

---

## 2. USDC オンランプ（保留中・2026-05-22 時点）

**結論：現状は外部取引所案内のみで運用**。`/start/v2` Step 2 は「USDC を既に持っている → 次へ」を主導線にし、無い人には Coincheck / bitFlyer / Coinbase へのリンクを表示する設計に切り替え済み。

### 検討した選択肢

| プロバイダ | JP 対応 | 状態 |
|---|---|---|
| Stripe Crypto on-ramp | ❌ US/EU only | 2026-05-22 確認：日本アカウントでは申請不可 |
| MoonPay | ✅ JPY 対応 | 未申請 |
| Coinbase Onramp（CDP） | ✅ Coinbase Japan 経由 | 候補本命（FSA 登録 #00029 と整合） |

### Coinbase Onramp 採用時の手順（未着手）

1. https://portal.cdp.coinbase.com/products/onramp で開発者アカウント
2. App ID 取得
3. `start/v2/page.tsx` に Coinbase Pay SDK 統合
4. 環境変数 `NEXT_PUBLIC_COINBASE_APP_ID` 追加

実装は別タスク。今は外部リンクのみで PLG ユーザー（USDC を既に持つ開発者層）には十分。

---

## 3. Pimlico Paymaster（1時間・推奨・無料枠あり）

ガス代を LemonCake が建て替えるための paymaster。USDC は触らないので
FSA Q11 の境界線を超えない。

### 取得手順

1. https://dashboard.pimlico.io にアクセス
2. **「Create account」** → GitHub で OAuth
3. **「Create API key」** → ネットワーク: Base
4. **API key**（`pim_xxxxx`）をコピー
5. ダッシュボードで Base のクレジット $50 程度をチャージ
   （実証実験フェーズなら $10 で 1 万トランザクション）

### Vercel への設定

```bash
echo "pim_xxxxxxxx" | vercel env add PIMLICO_API_KEY production
```

注：これは server-side で使うので `NEXT_PUBLIC_` プレフィックス
なしで OK。サーバー側 API ルートで読み込みます。

### Paymaster の使い所

`/start/v2` の Step 3 で permit に署名するときには gas 不要（permit
はオンチェーン tx ではなく EIP-712 署名のみ）。Pimlico paymaster が
活きるのは **permit を実際に USDC.transferFrom() するタイミング**で、
これは API 提供者側 or LemonCake のサーバー側 relayer が呼びます。

実装は今回のセッション範囲外。Migration doc に整理：
`docs/MIGRATION_NON_CUSTODIAL_v2.md`

---

## 4. npm publish（5分・Touch ID 必要）

外部キーとは別軸。下記 2 パッケージの公開で兄弟 MCP のバッジが伝播。

```bash
cd /Users/workoutsomehow/adhunt-pro/mcp-server
npm publish
# → Touch ID 待ち

cd /Users/workoutsomehow/adhunt-pro/lemoncake-mcp-sdk
npm publish --access public
# → Touch ID 待ち
```

兄弟 3 MCP（alpaca-guard / xstocks / tokenized-stock）は別途 publish
する場合に同様の手順で。

---

## 全部終わったら

`/start/v2` で実際に：

1. Google ログイン（Privy 経由）
2. Stripe Crypto onramp ボタンが新タブで開く
3. permit 署名がブラウザの Privy モーダルから本物の EIP-712 sign

…が動きます。

確認ポイント：
- `/start/v2` 上部のバナーから「⚠️ Privy App ID 未設定」が消える
- 「⚠️ Stripe Crypto on-ramp 未設定」のテキストも消える
- 署名後、permit の `r/s/v` が実際にウォレットからの値になる

---

## 順序の推奨

優先度どおりに：

1. **Privy** 先（無料 + 即時 + 必須）
2. **npm publish** 次（待ち時間ゼロ）
3. **Stripe** 申請（審査待ち中に他のことを進める）
4. **Pimlico** 最後（実 settlement を実装する段階で）

ステップ 1 と 2 を今夜進めれば、明朝には `/start/v2` 上で実 Google
ログインが動きます。
