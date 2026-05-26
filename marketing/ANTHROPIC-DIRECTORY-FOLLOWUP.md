# Anthropic Directory フォローアップ — 2026-05-26

## コンテキスト

- **2026-05-07**: lemon-cake-0.5.0.mcpb で Directory 申請 (npm rename to pay-per-call-mcp と同期)
- **2026-05-08**: 申請メール送信、自動返信 "expect review within ~2 weeks"
- **2026-05-22**: レビュー結果到着予定日 (per memory)
- **2026-05-26 (今日)**: **4 日経過、まだ音沙汰なし** → 自然なフォロー時期

「Pro tier の値段表記 update 申請」と同時に、status check のメールを送るのが効率的。
review 期間中なら丁寧 follow-up、もし採択済なら listing 更新依頼、不採択なら理由開示依頼。

---

## 送信先 / 件名

宛先は元の自動返信メールから引用する `partners@anthropic.com` または `developer-partnerships@anthropic.com` (申請時の正式宛先を確認すること)。

件名は元 thread の subject line をコピーして `Re:` 付ける (新規 thread だと bury される)。

---

## メール本文 (英語、丁寧 + 短い)

```
Subject: Re: LemonCake (pay-per-call-mcp) Directory submission — status + listing update

Hi Anthropic Directory team,

Quick follow-up on the lemon-cake-0.5.0.mcpb submission sent on
2026-05-08. The autoresponder indicated a ~2-week review window, so
checking in now that we're at week 3.

While checking in, two pieces of context I wanted to surface in case
they're useful for the listing:

  1. **Pricing model updated 2026-05-26.** We've shifted from
     "contact for pricing" to transparent published tiers:
       - Free up to 1,000 tx/month (gas sponsored on Base)
       - Pro $50/mo + $0.005/tx
       - Enterprise from $500/mo with KYA bundle
     Public page: https://lemoncake.xyz/pricing?utm_source=anthropic-directory&utm_medium=email&utm_campaign=followup-2026-05
     If the Directory listing carries pricing info, this is the
     current source of truth.

  2. **MPP compatibility added.** After Stripe Sessions 2026 shipped
     the Machine Payments Protocol, we wired the facilitator to accept
     MPP-signed payments alongside x402. This means an MCP installed
     from the Directory works with both Anthropic Connectors (x402
     style) and Stripe MPP-signed agents — no fork. Worth flagging
     if Anthropic is thinking about MPP interop more broadly.

Happy to send any additional materials, or to update the .mcpb bundle
if the listing prefers a current version. If the review is still in
progress, no action needed — just wanted to keep the file current and
flag the changes.

Thanks,
Hiroto Yoshida
evidai · contact@aievid.com
https://lemoncake.xyz?utm_source=anthropic-directory&utm_medium=email&utm_campaign=followup-2026-05 · github.com/evidai
```

---

## 想定回答 別の対応

### 回答パターン A: 「採択した、listing 公開中」
- 即返信: 「ありがとうございます、URL 教えていただけますか / 公開 listing から /pricing の link が貼れるか確認」
- listing の説明文に「Free up to 1k tx/mo」を含められるか相談
- 公開後の流入計測のため UTM 付き link で listing 用 URL 発行依頼 (https://lemoncake.xyz/?utm_source=anthropic-directory)

### 回答パターン B: 「採択した、しかし pricing update を反映するため bundle 再提出を」
- 即対応: `pay-per-call-mcp@latest` で新規 .mcpb を build (memory 参照 project_anthropic_directory_submission)
- README に /pricing badge を入れた版を bundle
- 24h 以内に再提出

### 回答パターン C: 「review 中、もう少し待って」
- 「了解です、pricing update だけ反映しておいてください」と返信
- 次の follow-up は **2026-06-09 (2 週間後)** 設定

### 回答パターン D: 「不採択」
- 理由開示依頼 + どこを直せば次の cycle で再申請可能か質問
- 不採択理由次第で `/consulting` 経由で Anthropic DevRel に別 angle で再アプローチ (Tier A の email #8)

### 回答パターン E: 返事なし (2 週間)
- **2026-06-09** に再フォロー、件名 "Re: Re: ..."
- 3 週目に何もなければ Anthropic Connectors team (別チーム) に DM
- 諦めライン: **2026-06-23 (合計 6 週間放置)**

---

## 送信前チェックリスト

- [ ] 元の申請メール / 自動返信メールを開き、正式な宛先と subject line を確認 (Gmail で "Anthropic Directory" 検索)
- [ ] `partners@anthropic.com` または `developer-partnerships@anthropic.com` のどちらが正規かを確認
- [ ] 上記 template を Gmail で下書き保存、送信前に 1 度自分で読み返す
- [ ] 送信時刻は **平日午前 9-11 時 PT (= 火-木の JST 26-28 時 = 翌 2-4 時)** が反応高い
- [ ] 送信後、Gmail label `anthropic/directory-2026-05` を付与
- [ ] 返信が来たら本ファイル末尾に追記、対応パターンを記録