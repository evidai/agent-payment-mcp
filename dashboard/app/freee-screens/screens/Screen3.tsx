// Screen 3 — 使い方3ステップ
export default function Screen3() {
  const steps = [
    {
      n: "1",
      title: "上限金額を設定して渡す",
      desc: "「このAIには $10 まで使っていい」と決めるだけ。有効期限も設定できます。",
      tag: "30秒で設定完了",
    },
    {
      n: "2",
      title: "AIが自動で支払い",
      desc: "AIが外部サービス（画像生成・データ取得など）を使うたびに、自動で決済。上限を超えそうになると自動停止。",
      tag: "人手ゼロ・24時間動作",
    },
    {
      n: "3",
      title: "freeeに自動で仕訳",
      desc: "決済の瞬間に freee へ自動記帳。勘定科目・源泉徴収・インボイス番号照合まで全自動。月末に何もしなくて良い。",
      tag: "月次経理がゼロに",
    },
  ];

  return (
    <div style={{
      width: 1200, height: 630, background: "#fffd43",
      display: "flex", flexDirection: "column",
      padding: "52px 72px", boxSizing: "border-box",
      fontFamily: "'Hiragino Sans', 'Noto Sans JP', sans-serif",
      overflow: "hidden", gap: 32,
    }}>
      <div>
        <div style={{ fontSize: 42, fontWeight: 900, color: "#1a0f00", marginBottom: 8 }}>たった3ステップで完結</div>
        <div style={{ fontSize: 18, color: "#1a0f00", opacity: 0.5 }}>設定は最初の1回だけ。あとはずっと自動で動き続けます</div>
      </div>

      <div style={{ display: "flex", gap: 20, flex: 1 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>
            {/* Step number */}
            <div style={{
              width: 52, height: 52, background: "#1a0f00", borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 900, color: "#fffd43", marginBottom: 20,
            }}>{s.n}</div>

            {/* Arrow between steps */}
            {i < 2 && (
              <div style={{
                position: "absolute", right: -18, top: 14,
                fontSize: 28, color: "#1a0f00", opacity: 0.25,
              }}>→</div>
            )}

            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a0f00", marginBottom: 12, lineHeight: 1.3 }}>
              {s.title}
            </div>
            <div style={{ fontSize: 16, color: "#1a0f00", opacity: 0.65, lineHeight: 1.7, flex: 1 }}>
              {s.desc}
            </div>
            <div style={{
              marginTop: 20, display: "inline-block",
              background: "#1a0f00", borderRadius: 100, padding: "8px 18px",
              fontSize: 13, fontWeight: 700, color: "#fffd43", alignSelf: "flex-start",
            }}>{s.tag}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
