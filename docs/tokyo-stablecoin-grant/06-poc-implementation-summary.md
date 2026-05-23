# PoC 実装サマリー — JPYC で動く LemonCake デモ

実装日: 2026-05-23
目的: 採択審査前に「JPYC でも動く LemonCake」のデモを完成させ、JPYC社・東京都への訴求力を最大化する
ステータス: ✅ **5項目完成・UI 完全動作・on-chain JPYC permit のみ JPYC社確認待ち**

---

## 完了した5項目（task #10-14）

| # | タスク | ステータス | 成果物 |
|---|---|---|---|
| 10 | Providers.tsx に Polygon chain 追加 | ✅ | `dashboard/app/Providers.tsx` |
| 11 | JPYC permit 動作確認スクリプト | ✅ | `scripts/test-jpyc-permit.mjs` |
| 12 | locale-detector + 通貨トグル UI | ✅ | `dashboard/app/lib/locale-detector.ts` + `dashboard/app/start/v2/page.tsx` |
| 13 | EIP-712 domain 通貨別 helper | ✅ | `dashboard/app/lib/permit.ts`（汎用化）|
| 14 | Pay Token JWT スキーマ拡張 | ✅ | `dashboard/app/lib/permit.ts`（currency/token 追加）|

---

## 変更ファイル一覧

### 新規作成
- `dashboard/app/lib/locale-detector.ts` （81行）  
  locale + localStorage + URL query + IP geo の優先順位で JPYC|USDC 判定
- `scripts/test-jpyc-permit.mjs` （220行）  
  Polygon 上の JPYC コントラクト on-chain 検証スクリプト（依存ゼロ）

### 修正
- `dashboard/app/Providers.tsx`  
  Wagmi config に Polygon (137) を追加（Privy supportedChains は既存）
- `dashboard/app/lib/permit.ts`  
  USDC専用 → 多通貨対応に汎用化。TOKENS レジストリ・signStablePermit・currency aware encode/decode
- `dashboard/app/start/v2/page.tsx`  
  通貨トグル UI、locale 自動検出、Step 1-4 全体を通貨対応に。JPYC モードに JPYC EX deeplink セクション追加

---

## オンチェーン検証で判明したこと

### ✅ 完全一致（即時利用可）
- **JPYC コントラクト**: `0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29` on Polygon
- **実装**: `0xafac17fc3936a29ca2d2787ced3c5d1c52007d2e`（ERC1967 proxy）
- **name()**: "JPY Coin"
- **symbol()**: "JPYC"
- **decimals()**: 18
- **PERMIT_TYPEHASH**: `0x6e71eda...d6126c9` ＝ 標準 EIP-2612 と一致
- **nonces(address)**: 動作
- **totalSupply**: 22.7億 JPYC（アクティブな流通）

### 🟡 1点だけ未確定（JPYC社確認待ち）
- **`DOMAIN_SEPARATOR()` の public getter が revert**
- → EIP-712 ドメインの **version 文字列**を外部から検証できない
- → permit 署名を実 contract に通すには JPYC社から version 値を取得必要

### この発見が示すこと
1. **悪い news ではない**：permit 関数自体は実装されており、typehash も標準
2. **JPYC社へのアプローチが技術的に重みを増す**：単なる協業打診ではなく「technical due diligence の結果」として接触できる
3. **採択審査でアピールできる**：個人事業主が単独で本番コントラクトをここまで verify している事例は少ない

---

## デモ UI の動作

`/start/v2` の動き方：

### 1. アクセス時
- 日本ロケール（ja-JP）→ **JPYC 自動デフォルト**
- 海外ロケール → USDC 自動デフォルト
- URL に `?currency=JPYC` で強制指定可

### 2. 通貨トグル
- ヘッダー直下に大きな2択トグル
- 切替で localStorage に永続化
- JPYC 選択時：「🚧 実験的機能」バナー表示

### 3. Step 2（チャージ）
- **JPYC 選択時**：JPYC EX 公式 deeplink（¥1,000 / ¥3,000 / ¥5,000）
- **USDC 選択時**：従来の Coinbase Onramp + Transak フロー

### 4. Step 3（署名）
- chain / token / cap / spender / owner を表示
- JPYC: Polygon 137 / `0xE7C3...` / ¥3,000/day
- USDC: Base 8453 / `0x8335...` / $25/day

### 5. Step 4（完了）
- 通貨対応の説明テキスト
- 同じ permit blob 形式（後方互換あり）

---

## 補助金事業計画書への組み込みポイント

### 「実現性」セクションで使える具体エビデンス
1. **動くデモ URL**: https://lemoncake.xyz/start/v2 （JPYC トグル可）
2. **on-chain 検証スクリプト**: `scripts/test-jpyc-permit.mjs` の実行ログ
3. **コード差分**: GitHub PR として可視化可能
4. **技術的深さ**: DOMAIN_SEPARATOR の問題まで踏み込んでいる事実

### 「先駆性」セクションで使える要素
- 国内初の「JPYC permit (ERC-2612) ベース AI エージェント決済」プロトタイプ
- ノンカストディ設計 × JPYC = FSA Q11 維持
- Privy embedded wallet × JPYC は前例なし

### 「都内経済波及」セクションで使える接続
- 都内ユーザーが /start/v2 にアクセス → 自動的に JPYC モード
- JPYC EX 経由で JPYC 購入 → 直接プロバイダに送金
- JPYC 流通量増加に直接寄与

---

## 残タスク（採択後に外注で実装）

これらは補助金事業 Phase 1-3 のスコープに入れて、**区分C: 外注 3,000万円**で計上：

- JPYC EX API 統合（銀行振込・着金 webhook・クレカ）— Phase 1
- JPYC Embedded Charge Modal 本実装（現状は deeplink） — Phase 2
- Spender contract の JPYC 対応 + メータリング DB — Phase 1
- Provider ダッシュボード JPYC 受領設定 — Phase 2
- freee / MF JPYC 仕訳連携 — Phase 2
- 都内 SaaS 実証実験のインフラ整備 — Phase 3

---

## 5/25 (月) JPYC社打診時の3つの技術質問

メール草案（`02-jpyc-corp-outreach.md`）に既に組み込み済：

1. **EIP-712 domain.version の値**を教えてください（DOMAIN_SEPARATOR 公開 getter が revert するため確認できず）
2. **JPYC EX 法人 API アクセス申請手続き**（銀行振込・カード・webhook）
3. **東京都ステーブルコイン補助金への協業意向表明（LOI）**の可否

→ 技術質問を最初に出すことで、「ちゃんと検証している事業者」として認識される。

---

## 動作確認方法

### ローカルで動かす
```bash
cd dashboard
npm install
# 既存の .env.local に NEXT_PUBLIC_PRIVY_APP_ID 等が入っていることが前提
npm run dev
# → http://localhost:3000/start/v2 で通貨トグル動作確認
```

### TypeScript 型チェック
```bash
cd dashboard
npx tsc --noEmit
# (.next/dev/types/validator.ts の pre-existing エラー 2件以外はクリーン)
```

### JPYC コントラクト on-chain 検証
```bash
node scripts/test-jpyc-permit.mjs
# 自分のウォレットアドレスで nonces も確認したい場合:
node scripts/test-jpyc-permit.mjs --owner 0xYourAddress
```

---

## 今すぐ次にやれる小さなこと

- [ ] `dashboard/.env.local.example` に Polygon RPC URL の必要性を追記
- [ ] `dashboard/app/api/proxy` 側で `currency` permit 検証ロジックを追加（spender 側のサーバーコード）
- [ ] `@lemon-cake/mcp-sdk` の decodePermit を v0.3.0 として publish（後方互換あり）
- [ ] /home ダッシュボードに通貨切替トグルを表示（現状 /start/v2 のみ）

これらは PoC レベルなので、5/25 のキックオフ後の余裕時間で進めれば OK。
