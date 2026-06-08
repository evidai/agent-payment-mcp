// Screen 2 — 「今の課題」を示す
export default function Screen2() {
  const problems = [
    "ChatGPTや画像生成AIに会社のカードを渡すのは怖い",
    "AIがいくら使ったか、リアルタイムでわからない",
    "決済のたびに手動で経費申請・仕訳をしている",
    "AIが暴走して予算を使い切っても気づけない",
  ];
  const solutions = [
    "使える金額を決めたトークンをAIに渡すだけ",
    "ダッシュボードで残高・使用額をリアルタイム確認",
    "決済の瞬間に自動でfreeeへ仕訳（人手ゼロ）",
    "上限を超えた瞬間、自動でブロック。1クリックで即停止も可",
  ];

  return (
    <div style={{
      width: 1200, height: 630, background: "#fffd43",
      display: "flex", flexDirection: "column",
      padding: "52px 72px", boxSizing: "border-box",
      fontFamily: "'Hiragino Sans', 'Noto Sans JP', sans-serif",
      overflow: "hidden", gap: 28,
    }}>
      <div>
        <div style={{ fontSize: 42, fontWeight: 900, color: "#1a0f00", marginBottom: 8 }}>
          こんな悩み、ありませんか？
        </div>
        <div style={{ fontSize: 18, color: "#1a0f00", opacity: 0.5 }}>LemonCake はAI活用中の経理担当者・開発者のために作られました</div>
      </div>

      <div style={{ display: "flex", gap: 20, flex: 1 }}>
        {/* Problems */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1a0f00", opacity: 0.45, marginBottom: 4 }}>よくある悩み</div>
          {problems.map((p, i) => (
            <div key={i} style={{
              background: "rgba(26,15,0,0.08)", borderRadius: 12, padding: "14px 18px",
              display: "flex", gap: 12, alignItems: "flex-start",
            }}>
              <div style={{
                width: 24, height: 24, background: "#1a0f00", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
              }}>
                <div style={{ width: 8, height: 2, background: "#fffd43" }} />
              </div>
              <span style={{ fontSize: 16, color: "#1a0f00", lineHeight: 1.5 }}>{p}</span>
            </div>
          ))}
        </div>

        {/* Arrow */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0 8px" }}>
          <div style={{ fontSize: 40, color: "#1a0f00", opacity: 0.3 }}>→</div>
        </div>

        {/* Solutions */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1a0f00", opacity: 0.45, marginBottom: 4 }}>LemonCake の解決策</div>
          {solutions.map((s, i) => (
            <div key={i} style={{
              background: "#1a0f00", borderRadius: 12, padding: "14px 18px",
              display: "flex", gap: 12, alignItems: "flex-start",
            }}>
              <div style={{
                width: 24, height: 24, background: "#fffd43", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
                fontSize: 13, fontWeight: 900, color: "#1a0f00",
              }}>✓</div>
              <span style={{ fontSize: 16, color: "#fffd43", lineHeight: 1.5 }}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
