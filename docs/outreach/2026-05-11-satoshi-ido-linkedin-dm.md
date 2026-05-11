# LinkedIn DM to Satoshi Ido — Alpaca MCP Server v2 maintainer

**Send via**: https://www.linkedin.com/in/idsts2670/
**From**: User's personal LinkedIn (must connect first if not already connected)
**When**: anytime — LinkedIn DMs are timezone-flexible
**Tone**: 同業エンジニア同士のカジュアル相談、丁寧すぎず

---

## Connection request message (limited to ~300 chars)

> 井戸さんはじめまして。横川さんの伝説ラジオ「日本人初の米ユニコーン」回拝見して、Alpaca のこと知りました。MCP server v2 のリリースもおつかれさまです、FastMCP + OpenAPI ベースの設計参考になりました。当方も MCP サーバー (pay-per-call-mcp) を出してて、agentic trading の支出制御で 1-2 質問させていただけたらと。よろしくお願いします。

(298 chars、LinkedIn 制限内)

**冒頭に 横川 + 伝説ラジオ を入れた理由**: JP 文脈で「Alpaca をちゃんと知って DM してる」signal。創業者の JP メディア出演を recognize するのは、シカゴ在住の Satoshi 氏にとって懐かしさ + 信頼度両方上がる。スパム DM との差別化も決定的。

---

## Follow-up DM (connection accepted 後)

> 井戸さん、connect ありがとうございます。
>
> 改めて — 横川さんの伝説ラジオ回 ([YouTube](https://www.youtube.com/watch?v=SMQu7agFqR0)) を見て Alpaca のことを知り、その後 GitHub で v2 リリースに気づいた、という入り口でした。日本人初の米ユニコーンを金融機関ゼロから作ったストーリー、エンジニアの視点で見ても示唆深かったです。
>
> 自己紹介 — LemonCake (lemoncake.xyz) という MCP サーバーを開発している evid.ai の者です。AI エージェントに「USDC ウォレット + 支出キャップ付き JWT (Pay Token)」を持たせて API 課金を proxy する仕組みで、現状 Glama AAB / Anthropic Connectors Directory 申請中です。
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
- Co-target email: claudiu.tiganetea@alpaca.markets (Gmail draft `r403305869398790153` — 伝説ラジオ angle 反映済み版。旧 `r349959950295789582` は破棄してください)
- Yokogawa 伝説ラジオ episode: [YouTube](https://www.youtube.com/watch?v=SMQu7agFqR0) / [Apple Podcast](https://podcasts.apple.com/jp/podcast/alpaca%E6%A8%AA%E5%B7%9D%E6%AF%85-%E6%97%A5%E6%9C%AC%E4%BA%BA%E5%88%9D%E3%81%AE%E7%B1%B3%E3%83%A6%E3%83%8B%E3%82%B3%E3%83%BC%E3%83%B3%E3%81%AB/id1823235581) — JP context relevance signal の根拠
