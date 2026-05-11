# LinkedIn DM to Satoshi Ido — Alpaca MCP Server v2 maintainer

**Send via**: https://www.linkedin.com/in/idsts2670/
**From**: User's personal LinkedIn (must connect first if not already connected)
**When**: anytime — LinkedIn DMs are timezone-flexible
**Tone**: 同業エンジニア同士のカジュアル相談、丁寧すぎず

---

## Connection request message (limited to ~300 chars)

> 井戸さんはじめまして。Alpaca MCP server の v2 リリースおつかれさまです、FastMCP + OpenAPI ベースの設計参考になりました。当方も MCP サーバー (pay-per-call-mcp) を出していて、エージェント trading の支出制御まわりで井戸さんの設計判断について 1-2 質問させていただけたらと思います。よろしくお願いします。

(282 chars, LinkedIn 制限内)

---

## Follow-up DM (connection accepted 後)

> 井戸さん、connect ありがとうございます。
>
> 自己紹介遅くなりました — LemonCake (lemoncake.xyz) という MCP サーバーを開発している evid.ai の者です。AI エージェントに「USDC ウォレット + 支出キャップ付き JWT (Pay Token)」を持たせて API 課金を proxy する仕組みで、現状 Glama AAB / Anthropic Connectors Directory 申請中です。
>
> Alpaca MCP v2 を見ていて、エージェント trading のもう一段上のレイヤーで「rogue agent が $50k 一発で買っちゃう」リスクをインフラレベルで抑える需要があるなと思いました。LemonCake の Pay Token (limitUsdc 強制 + KYA 段階) はまさにそのレイヤー向けの設計です。
>
> 今、`alpaca-guard-mcp` という形で、Alpaca MCP の前段に LemonCake Pay Token check を挟む wrapper MCP を 3-5 日で書こうとしています。OSS / MIT で公開予定。Alpaca v2 の tool surface に対して proxy するだけの薄い実装の予定なので、Alpaca 側に何か義務は発生しません。
>
> 出す前に、井戸さんの設計思想と齟齬がないかだけ確認させてもらえると助かります。具体的に：
>
> 1. v2 で `ALPACA_TOOLSETS` で tool whitelist できるのは知ったのですが、その上で **個別 call ごとに pre-flight check** (例：「この order を出すと 1日 cap 超過するから refuse」) を挟む設計、ベストプラクティスありますか？
> 2. もし `alpaca-guard-mcp` が安定したら、Alpaca 側でも cookbook / docs での紹介はあり得ますか？(義務としてではなく、temperature check として)
>
> 15 分 Zoom or async DM で結構です。お時間あるとき教えてください。
>
> — [your name] / evid.ai
> https://www.lemoncake.xyz/start

---

## なぜ JP-to-JP / LinkedIn を選んだか (内部メモ)

- Satoshi Ido = メインメンテナー (132 commits / 2位の 6 commits を大きく引き離す)
- 日本人 + シカゴ在住 → JP メッセージで届く
- LinkedIn は仕事文脈で確実に読まれる (Twitter は不在)
- 公開メールなし → LinkedIn が唯一の効率的経路
- Claudiu (org メール) と並列送信 → 接触面 2 倍

## フォローアップ計画

- DM 送信 +5 日返信なし → bump 1 行 ("先日のメッセージ、もし時間あればで結構です")
- DM 送信 +10 日返信なし → 撤退、Claudiu 経由でフォローアップ依頼

## 関連

- Alpaca MCP server: https://github.com/alpacahq/alpaca-mcp-server
- Satoshi LinkedIn: https://www.linkedin.com/in/idsts2670/
- Co-target email: claudiu.tiganetea@alpaca.markets (Gmail draft `r349959950295789582`)
