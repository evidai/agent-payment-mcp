<!--
公開先: Qiita 推奨（SEO 強い）/ Zenn にもクロスポスト可
推奨タグ:
  Qiita: MCP, AI, TypeScript, Claude, x402
  Zenn:  mcp, ai-agent, typescript, claude, payment
推奨絵文字 (Zenn): 🪙
推奨タイプ (Zenn): tech
推奨公開時刻: 火 or 水 9:00-10:00 JST
-->

# x402 互換 MCP サーバーを TypeScript で実装した話 — Pay Token vs on-chain auto-pay

AIエージェントが API を自律的に呼び出して**自動で支払いを完結させる**世界が、今年急速に現実的になってきた。鍵になっているのが Cloudflare と Coinbase が推している **x402** プロトコル — HTTP の 402 Payment Required ステータスコードを復活させて「リクエストに対して支払いを要求し、証明と引き換えにレスポンスを返す」流れを標準化する仕様だ。

ただ x402 を素直に実装しようとすると、**実 USDC をオンチェーンで送金する仕組み**が必要になる。HOT_WALLET の補充、ガス代の管理、失敗時のリカバリ。これは個人開発の MCP サーバーには重い。

そこで今回、自分が公開している MCP サーバー [`pay-per-call-mcp`](https://www.npmjs.com/package/pay-per-call-mcp) (旧 `lemon-cake-mcp`) で、**「x402 のレスポンス形だけ完全に互換にしておいて、実際の決済はオフチェーンの Pay Token (JWT) でやる」**というハイブリッド構成を v0.5.1 でリリースした。本記事では、

- 何を「互換」にしたのか
- TypeScript でどう実装したか (コード抜粋つき)
- なぜ on-chain auto-pay は「Phase B」として保留にしたか
- node:test で書いた回帰テスト

を共有したい。MCP サーバーを書いている人 / 課金代行型の API を作りたい人 / x402 がどう動くか具体的に知りたい人向けの記事。

---

## x402 とは何か (60秒)

ざっくり仕様：

1. クライアントが保護された API にリクエストを送る
2. サーバーが `402 Payment Required` を返す。レスポンスに「どのチェーン / どの asset / いくら / どこへ送れ」というチャレンジが含まれる
3. クライアントが支払いを実行 (USDC を recipient へ送金など)
4. クライアントが**支払い証明**つきで再リトライ
5. サーバーが証明を検証 → リソースを返す

ポイントは **2 と 5 だけが規約**で、実際の送金レイヤーは何でもいい (USDC / ETH / Lightning / オフチェーン代理)。

詳細は [x402.org](https://www.x402.org/) と [Cloudflare のブログ](https://blog.cloudflare.com/) 参照。

---

## 何を「互換」にしたのか

`pay-per-call-mcp` の決済モデルは Pay Token (短命の JWT に支出上限が付いている) で、サーバー側で利用枠を確認 → API を proxy → USDC 残高から差し引く、という**オフチェーン**処理。x402 とは別物。

それでも、**MCP クライアント (= エージェント側) が書く処理ロジック**は x402 と完全に同じになるよう、レスポンス形を寄せた。具体的には 3 つ：

1. **成功レスポンスに `x402Receipt`** — scheme / asset / amount / recipient / paymentIntentId / settledAt の正規 shape
2. **上流が 402 を返した時に `x402Challenge`** をパース — `WWW-Authenticate: x402 ...` / `X-402-*` ヘッダ / `body.x402` の 3 ソース対応
3. **`PAYMENT_PENDING` セマンティクス** — 上流が 202 + Retry-After を返したら「同じ idempotencyKey でリトライしろ」を返す

これだけで、エージェント側のコードは「on-chain x402 と互換」になる。後で本物の on-chain 送金に切り替えても、エージェントは何も変えなくていい。

---

## 実装1: x402Receipt (成功時のレシート形式)

```typescript
// src/x402.ts
export type X402Receipt = {
  scheme:           "lemoncake-pay-token-v1";
  x402Compatible:   true;
  chain:            string;
  asset:            string;
  amount:           string;
  recipient:        string;
  paymentIntentId:  string;
  settledAt:        string;
  note:             string;
};

export function buildX402Receipt(opts: {
  chargeId:   string | null;
  amountUsdc: string | null;
  serviceId:  string;
  mode:       "demo" | "live";
}): X402Receipt {
  return {
    scheme:          "lemoncake-pay-token-v1",
    x402Compatible:  true,
    chain:           "off-chain (LemonCake Pay Token)",
    asset:           "USDC",
    amount:          opts.amountUsdc ?? "0.00",
    recipient:       opts.serviceId,
    paymentIntentId: opts.chargeId ?? `${opts.mode}_${Date.now().toString(36)}`,
    settledAt:       new Date().toISOString(),
    note:            opts.mode === "demo"
      ? "Demo Mode: receipt shape is illustrative, no actual settlement."
      : "Off-chain settlement via Pay Token. On-chain x402 receipt mode is gated (HOT_WALLET).",
  };
}
```

ポイント：

- **`scheme` を `lemoncake-pay-token-v1` と明示**して「on-chain ではない」ことを正直に名乗っている。エージェントが「これは canonical x402 の receipt じゃない」と判断したい場合に scheme で振り分けられる
- **`x402Compatible: true`** の boolean で「shape は互換」と宣言
- chain / asset / amount / recipient / paymentIntentId / settledAt は x402 spec と完全一致

---

## 実装2: 上流の x402 challenge をパースする

これが一番設計に悩んだ部分。x402 spec は「サーバーがチャレンジを返す方法」を**3 通り**サポートしているので、3 つ全部対応する必要がある：

1. `WWW-Authenticate: x402 chain="base" asset=USDC amount=0.01 recipient=0xabc`
2. `X-402-Chain: polygon` / `X-402-Asset: USDC` / `X-402-Amount: 0.05` / `X-402-Recipient: 0xdef`
3. JSON body に `{ "x402": { "chain": "ethereum", ... } }`

```typescript
export function parseX402Challenge(
  headers: Headers,
  body:    unknown,
): Record<string, string> | null {

  // 1. WWW-Authenticate ヘッダ
  const wwwAuth = headers.get("www-authenticate");
  if (wwwAuth && /^\s*x402\b/i.test(wwwAuth)) {
    const params: Record<string, string> = {
      source: "WWW-Authenticate",
      scheme: "x402",
    };
    const re = /(\w+)=("([^"]*)"|(\S+))/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(wwwAuth))) {
      params[m[1]] = m[3] ?? m[4];
    }
    return params;
  }

  // 2. X-402-* ヘッダ
  const headerKeys = [
    "x-402-chain", "x-402-asset", "x-402-amount",
    "x-402-recipient", "x-402-callback",
  ];
  const fromHeaders: Record<string, string> = {};
  for (const k of headerKeys) {
    const v = headers.get(k);
    if (v) fromHeaders[k.replace(/^x-402-/, "")] = v;
  }
  if (Object.keys(fromHeaders).length > 0) {
    return { source: "X-402-* headers", scheme: "x402", ...fromHeaders };
  }

  // 3. body.x402
  if (body && typeof body === "object" && body !== null && "x402" in (body as object)) {
    const inner = (body as Record<string, unknown>).x402;
    if (inner && typeof inner === "object") {
      const flat: Record<string, string> = {
        source: "response.x402",
        scheme: "x402",
      };
      for (const [k, v] of Object.entries(inner as Record<string, unknown>)) {
        flat[k] = String(v);
      }
      return flat;
    }
  }

  return null;
}
```

設計上の決定 3 点：

1. **戻り値に `source` を含める** — どのチャネルから来たチャレンジかをパース後も追跡できる。デバッグと将来の優先度判定に使う
2. **`/(\w+)=("([^"]*)"|(\S+))/g`** — クォート付き / クォートなし両対応の RFC ライク parser。`asset=USDC` も `chain="base mainnet"` も同じ regex で拾える
3. **3 ソースの優先順位は WWW-Authenticate > X-402-* > body** — RFC スタイルが最も spec に近いので最優先。これが**回帰テストでもチェックしている**重要な仕様

---

## 実装3: PAYMENT_PENDING セマンティクス

オンチェーン送金や非同期決済では「支払いはまだ着金してないが、リクエストは受け付けた」状態が発生する。これを `call_service` から構造化レスポンスで返す：

```typescript
// call_service の上流レスポンス処理から抜粋
if (
  res.status === 202 &&
  res.headers.get("x-payment-status")?.toLowerCase() === "pending"
) {
  const retryAfterMs =
    parseInt(res.headers.get("retry-after") ?? "5", 10) * 1000;
  return json({
    status:           "PAYMENT_PENDING",
    paymentIntentId: res.headers.get("x-payment-intent-id")
                     ?? chargeId
                     ?? `pending_${Date.now().toString(36)}`,
    retryAfterMs,
    retryContract: `Call \`call_service\` again with the SAME idempotencyKey="${idempotencyKey ?? "<set one and retry>"}" after ${retryAfterMs}ms. The original request will resume; no double-charge.`,
  });
}
```

肝は **`retryContract` を自然言語で返す**こと。MCP のレスポンスは LLM が読む。「同じ `idempotencyKey` で `retryAfterMs` 後に再呼び出ししろ、二重課金しない」と日本語/英語で書いておけば、エージェントは別途プロンプトエンジニアリングなしで正しくリトライしてくれる。

---

## なぜ on-chain auto-pay を Phase B として保留にしたか

ここまでで「インターフェース層の x402 互換」は完成したけど、**本物の on-chain 自動支払い**は実装しなかった。理由は単純で、

1. **HOT_WALLET の補充パイプラインがまだ未稼働** — SBI VC Trade KYC → JPY → USDC → Polygon withdraw → HOT_WALLET の経路が、現状残高 $0
2. **顧客がいない** — 月間 buyer 数が今 0 人なので、auto-pay 機能は実装しても誰も使わない
3. **段階を踏みたい** — interface だけ先に出しておけば、HOT_WALLET 解禁後に「実装は実は既にあった」感を出せる

なので [GitHub issue #4](https://github.com/evidai/lemon-cake/issues/4) に Phase B として明示し、トリガー条件を 3 つ書いた：

- (a) 月間 buyer 数 ≥ 1
- (b) 外部 dev が x402 関連で issue / DM してくる
- (c) Cloudflare or Anthropic が x402 reference impl を出す

どれかが満たされた時点で着手する。**機能を作る前に「誰のために作っているか」を明示する**のは個人開発でも重要だと最近痛感した。

---

## 回帰テスト (Node 標準テストランナーだけで完結)

外部 dep を増やしたくなかったので Node 20 の `node:test` を使った：

```typescript
// test/x402.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildX402Receipt, parseX402Challenge } from "../dist/x402.js";

test("parseX402Challenge: WWW-Authenticate is case-insensitive on scheme name", () => {
  const headers = new Headers({
    "www-authenticate": "X402 chain=base asset=USDC",
  });
  const out = parseX402Challenge(headers, null);
  assert.equal(out?.scheme, "x402");
  assert.equal(out?.chain, "base");
});

test("parseX402Challenge: WWW-Authenticate takes precedence over X-402-* headers", () => {
  const headers = new Headers({
    "www-authenticate": "x402 chain=base",
    "x-402-chain":      "polygon",
  });
  const out = parseX402Challenge(headers, null);
  assert.equal(out?.source, "WWW-Authenticate");
  assert.equal(out?.chain, "base");
});

test("parseX402Challenge: ignores non-x402 WWW-Authenticate (Basic, Bearer)", () => {
  for (const v of ["Basic realm=\"x\"", "Bearer realm=\"y\""]) {
    const out = parseX402Challenge(
      new Headers({ "www-authenticate": v }), null);
    assert.equal(out, null, `should not match ${v}`);
  }
});
```

`package.json` に `"pretest": "npm run build"` を入れておけば、`npm test` で TypeScript ビルド → 11 テスト実行が自動で走る。CI でもローカルでも同じ動作。

```bash
$ npm test
✔ parseX402Challenge: WWW-Authenticate header (12 ms)
✔ parseX402Challenge: WWW-Authenticate is case-insensitive on scheme name
✔ parseX402Challenge: X-402-* headers are parsed and stripped of prefix
✔ parseX402Challenge: body.x402 object
✔ parseX402Challenge: returns null when no challenge present
✔ parseX402Challenge: ignores non-x402 WWW-Authenticate (Basic, Bearer)
✔ parseX402Challenge: header source wins over body when both present
✔ parseX402Challenge: WWW-Authenticate takes precedence over X-402-* headers
✔ buildX402Receipt: live mode produces canonical shape
✔ buildX402Receipt: demo mode marks the note explicitly
✔ buildX402Receipt: paymentIntentId fallback is unique per call
ℹ tests 11
ℹ pass 11
ℹ fail 0
```

---

## まとめ

- x402 spec は「**形が決まっていれば実装は何でもいい**」という性質。これを利用してオフチェーン Pay Token + x402 互換レスポンスのハイブリッドは現実的に作れる
- TypeScript + node:test だけで実装 + テスト完結 (外部 dep ゼロ)
- 「**全機能を実装してから出す**」ではなく、interface 層だけ先に出して on-chain は段階で追加する戦略は、個人開発の MCP サーバーで効く
- Phase A 出してから 1 週間で 14 行 / 11 テストの回帰スイートも書けたので、今のところ品質的にも安心

実装全体は GitHub の [evidai/lemon-cake](https://github.com/evidai/lemon-cake) で MIT。試したい方は signup 不要で

```bash
npx -y pay-per-call-mcp
```

Demo Mode は env 変数空のままで起動して、Wikipedia / FX / httpbin が叩けるので、5 秒で挙動が分かります。

質問・ツッコミは GitHub issue で。

---

**関連リンク**
- npm: [pay-per-call-mcp](https://www.npmjs.com/package/pay-per-call-mcp)
- GitHub: [evidai/lemon-cake](https://github.com/evidai/lemon-cake)
- Glama listing: [LemonCake — AI Agent Wallet & USDC Pay-per-call](https://glama.ai/mcp/servers/evidai/lemon-cake)
- ブラウザで試せる playground: [lemoncake.xyz/start](https://www.lemoncake.xyz/start)
- x402 仕様: [x402.org](https://www.x402.org/)
- 関連 issue (Phase B): [#4](https://github.com/evidai/lemon-cake/issues/4)
