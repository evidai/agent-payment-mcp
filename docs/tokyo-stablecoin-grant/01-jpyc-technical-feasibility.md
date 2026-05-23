# JPYC 技術調査レポート — Embedded UX 実装可否

調査日: 2026-05-20
対象: 東京都ステーブルコイン補助金事業 Phase 1 技術前提確定

---

## TL;DR

| 項目 | 結論 |
|---|---|
| JPYC 新規制版コントラクト on Polygon | ✅ 取得 `0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29` |
| 実装コントラクト（ERC1967 proxy） | ✅ `0xafac17fc3936a29ca2d2787ced3c5d1c52007d2e` （on-chain で確認済） |
| name() / symbol() / decimals() | ✅ "JPY Coin" / "JPYC" / 18 （on-chain で確認済） |
| 総供給量 | ✅ 約 22.7億 JPYC（2026-05-23 時点、アクティブ）|
| PERMIT_TYPEHASH | ✅ 標準 EIP-2612 ハッシュと一致 |
| nonces(address) | ✅ 公開・読み取り可能 |
| **DOMAIN_SEPARATOR() の公開 getter** | 🟡 **revert する** — EIP-712 version 文字列が外部から検証不可 |
| EIP-712 version の値 | 🔴 **要 JPYC社に直接確認**（permit 署名のクリティカルパス）|
| ERC-2612 permit 関数 | ✅ 関数自体は実装されている（PERMIT_TYPEHASH 露出から推定）|
| LemonCake v2 USDC permit 設計の JPYC 移植 | ✅ 設計上可能だが、**version 確定までは experimental 扱い** |
| 公式 SDK 提供 | ⚠️ 新規制版用は公開リポジトリ非常に少ない |
| JPYC EX API | ⚠️ 開発者ドキュメントは認証付き（faq.jpyc.co.jp 403）|
| マルチチェーン | Ethereum / Polygon / Avalanche の3チェーンで発行 |

→ **静的フィールド（name/symbol/decimals/typehash）は全て LemonCake の前提と一致**。  
→ **唯一のブロッカーは EIP-712 domain.version 文字列**：JPYC社へ 5/25 の協業打診メールで直接確認する。  
→ ダッシュボード UI（通貨トグル・locale 判定・encode/decode）は完成済、本番デプロイ可能。on-chain JPYC permit 署名のみ「experimental」扱い。

---

## 1. JPYC コントラクト構造

### 新規制版（2025/10/27 発行）
- **アドレス**: `0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29`
- **実装パターン**: ERC1967Proxy（アップグレード可能）
- **実装コントラクト**: `0xafAC17FC3936A29CA2D2787cEd3c5d1c52007d2e`
- **トークン情報**: Name "JPY Coin", Symbol "JPYC", Decimals **18**
- **追加機能**: Blocklistable / Pausable / Rescuable（規制対応のための管理機能）
- **Owner**: `0x11f14c2bfe398379b361019aa440f792c27f9384`（JPYC: Deployer）

### 旧版（前払式支払手段 = JPYC Prepaid）
- **アドレス**: `0x431D5dfF03120AFA4bDf332c61A6e1766eF37BDB`
- **状態**: 旧 PolygonScan で「JPYC Prepaid」として表示、依然として流通
- **補助金審査でどちらを使うか**: 必ず **新規制版（0xE7C3D8C9...）** を使う。理由：
  - 補助金要件「実発行された円建てSC」「日本円建てSC」「法令遵守」を満たすのは新規制版のみ
  - JPYC 社が「資金移動業」ライセンスで発行している正規版

### マルチチェーン
JPYC は Ethereum / Polygon / Avalanche の3チェーンで発行（同一の規制版）。LemonCake 補助金事業では **Polygon** を主軸にする（ガス代が安く、v1 で実装経験あり）。

---

## 2. ERC-2612 Permit 対応の確認

PolygonScan の source code から、contracts/v1/EIP2612.sol を含むことを確認:

```solidity
// 確認された機能
function permit(
    address owner,
    address spender,
    uint256 value,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
) external;

function DOMAIN_SEPARATOR() external view returns (bytes32);

function nonces(address owner) external view returns (uint256);
```

→ LemonCake v2 の USDC permit フロー（90日署名）を JPYC でそのまま実装可能。  
→ Privy `signTypedData` でユーザーが署名 → spender が一定期間 JPYC を引き出し。  
→ ノンカストディ設計が JPYC でも維持される（**FSA Q11 回答もそのまま有効**）。

---

## 3. EIP-3009 transferWithAuthorization 対応

EIP3009.sol を含むことを確認:

```solidity
function transferWithAuthorization(
    address from,
    address to,
    uint256 value,
    uint256 validAfter,
    uint256 validBefore,
    bytes32 nonce,
    uint8 v,
    bytes32 r,
    bytes32 s
) external;

function receiveWithAuthorization(...) external;
```

→ permit（90日）と並走して、単発の transferWithAuthorization も実装可能。  
→ Coinbase x402 系統との互換性も維持される。

### 2022 年の監査指摘（要対応）
JPYC の旧版 EIP-3009 実装で、同じ nonce を使った別 recipient の署名が無効化される問題が code4rena 監査で指摘されている。新規制版で修正されているか要追加調査。LemonCake 側では **常にユニークな nonce を生成する設計**を取ればこの問題を回避可能。

---

## 4. JPYC EX API（fiat onramp）

### 公開状況
- 公式 SDK ドキュメント: `faq.jpyc.co.jp/s/article/developer-documentation` → **403 Forbidden**（認証必要）
- 旧版 SDK: `jpyc-core-sdk` (PyPI) は JPYCv2（前払式版）対応
- 公式 GitHub `jpycoin`: 公開リポジトリは `.github` のみ、SDK / Contracts / API examples は非公開

### 既知の機能（公開情報からの推測）
- 銀行振込 → JPYC 即時発行（API 経由で発行予約用の振込先口座番号生成可能）
- クレジットカード → JPYC（CRYPTO TIMES 等で「カード支払いにも対応」と確認）
- 発行・償還ともに **手数料無料**（公式サイト）
- AML/トラベルルール対応（API 経由で発行する場合、第三者サービサーのスクリーニング義務あり）

### 補助金事業での対処
- Phase 1 最初の30日で **JPYC 社へ法人/個人事業主向け API アクセス申請**
  - 連絡先: corporate.jpyc.co.jp の問合せフォーム
- 並行して **岡部典孝氏（代表）へ X DM / メール**で協業打診
  - LOI / API キー優先付与が取れれば補助金審査で決定打

### コンプライアンス要件（Qiita Rascal 氏記事より）
JPYC を組み込むサービサーは **独立して AML 責任を負う**：
1. 受取先スクリーニング（OFAC SDN、国内ウォッチリスト、グラフ近接、ML 異常）
2. 閾値検知（日本 ¥100,000 が法令ベースライン、コンサバなら $1,000）
3. トラベルルール発火（IVMS 101 メッセージング）
4. 証跡保全（7年保管、改ざん不可ストレージ）

→ **補助金区分B（専門家・監査経費）でスクリーニング SaaS 導入や AML 弁護士相談を計上可能**

---

## 5. LemonCake v2 USDC → JPYC 移植の差分

| 領域 | USDC v2 現状 | JPYC 移植 | 工数 |
|---|---|---|---|
| Token address | Base USDC | Polygon JPYC `0xE7C3...` | 1日（env 追加） |
| Chain | Base 8453 | Polygon 137 | 1日（wagmi config） |
| EIP-712 domain | Base USDC | Polygon JPYC（name "JPY Coin", chainId 137, verifying contract）| 2日 |
| permit 関数呼出 | 動作確認済 | 同じシグネチャ | 半日 |
| Privy chain config | Base | Polygon 追加（マルチチェーン共存）| 2日 |
| Spender contract | 0xDEAD プレースホルダ | JPYC 受領用 spender 実装 | 5-10日 |
| メータリング | USDC 建て | JPYC 建て（為替なし、円計算）| 5日 |
| Coinbase Onramp | Apple Pay → USDC | **JPYC EX API → JPYC** に置き換え | **15-30日**（最大 R&D ポイント）|

**合計工数概算**: 1人月 (1名フルタイム 4週間) で **JPYC 統合 MVP** 完了可能。  
補助金区分C「外注エンジニア × 3名 × 6ヶ月 = 3,000万円」のうち、JPYC 関連は **2-3 人月で十分**。残りは UX/メータリング/Provider 登録に投下。

---

## 6. クリティカルパス

```
Phase 1（採択〜3ヶ月）:
  [Week 1-2] JPYC 社へ API アクセス申請 + 岡部氏アプローチ
  [Week 3-4] Polygon JPYC permit 動作確認 (LemonCake spender 実装)
  [Week 5-8] JPYC EX API 統合 (銀行振込 deeplink + 着金検知)
  [Week 9-12] Privy x JPYC マルチチェーン UX 構築

Phase 2（〜6ヶ月）:
  [Month 4] LemonCake UI 内 Embedded Charge モーダル完成
  [Month 5] 通貨ルーティング (locale 自動 + 手動切替) 実装
  [Month 6] freee / MF JPYC 仕訳連携

Phase 3（〜9ヶ月）:
  [Month 7-9] 都内中小 SaaS 3社で実証実験
              成果報告 (補助金確定検査用)
```

---

## 7. 主要参考リンク

- [JPYC 新規制版コントラクト on PolygonScan](https://polygonscan.com/address/0xe7c3d8c9a439fede00d2600032d5db0be71c3c29)
- [JPYC 旧版 (Prepaid) on PolygonScan](https://polygonscan.com/address/0x431D5dfF03120AFA4bDf332c61A6e1766eF37BDB)
- [JPYC 株式会社コーポレート](https://corporate.jpyc.co.jp/)
- [JPYC EX 公式](https://jpyc.co.jp/)
- [岡部典孝氏 X](https://x.com/noritaka_okabe)
- [JPYC 公式 GitHub](https://github.com/jpycoin)
- [JPYC B2B 実装ガイド (Qiita Rascal 氏)](https://qiita.com/Rascal/items/d1a09c26e284195a3eaa)
- [EIP-2612 Permit](https://eips.ethereum.org/EIPS/eip-2612)
- [EIP-3009 Transfer With Authorization](https://eips.ethereum.org/EIPS/eip-3009)
- [自民党AI×ブロックチェーンPT (CRYPTO TIMES)](https://crypto-times.jp/news-ldp-to-establish-new-working-group-on-ai-and-blockchain-will-jpyc-be-the-key/)

---

## 8. 次のアクション

1. **JPYC EX 法人/個人事業主 API アクセス申請** （Task #6 と統合）
2. **JPYC 新規制版コントラクトの permit を実機テスト**（Privy ウォレットで signTypedData → permit 呼出 → 残高変化確認）
3. **AML スクリーニング SaaS 候補リサーチ**（Chainalysis / Elliptic / TRM Labs / 国内ベンダー）
4. **トラベルルール対応の弁護士相談セット**（補助金区分B経費）
