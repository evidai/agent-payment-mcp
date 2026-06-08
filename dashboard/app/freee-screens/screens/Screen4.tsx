// Screen 4 — Before/After（超シンプル版）
export default function Screen4() {
  const before = [
    "各サービスのCSVを手動ダウンロード",
    "為替レートを日付ごとに手動換算",
    "源泉徴収の対象か自分で調べる",
    "国税庁でインボイス番号を手照合",
    "freeeにCSVインポートして科目を手入力",
  ];
  const after = [
    "AIが使うたびに自動で記録される",
    "自動でJPYに換算して記帳",
    "源泉徴収10.21%/20.42%を自動計算",
    "インボイス番号を自動で照合",
    "freeeに即時仕訳。月末の作業ゼロ",
  ];

  return (
    <div style={{
      width: 1200, height: 630, background: "#fffd43",
      display: "flex", flexDirection: "column",
      padding: "48px 64px", boxSizing: "border-box",
      fontFamily: "'Hiragino Sans', 'Noto Sans JP', sans-serif",
      overflow: "hidden", gap: 24,
    }}>
      <div>
        <div style={{ fontSize: 40, fontWeight: 900, color: "#1a0f00", marginBottom: 8 }}>
          月の経理作業、こう変わります
        </div>
        <div style={{ fontSize: 17, color: "#1a0f00", opacity: 0.55 }}>
          AIを使うほど経理工数が増える時代 → LemonCakeで全部自動化
        </div>
      </div>

      <div style={{ display: "flex", gap: 20, flex: 1 }}>
        {/* Before */}
        <div style={{ flex: 1, background: "rgba(26,15,0,0.07)", borderRadius: 18, padding: "28px 28px 24px", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1a0f00", opacity: 0.4, marginBottom: 6 }}>今まで</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#1a0f00", marginBottom: 20 }}>毎月 手作業</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
            {before.map((item, i) => (
              <div key={i} style={{
                background: "rgba(26,15,0,0.08)", borderRadius: 10, padding: "11px 16px",
                fontSize: 15, color: "#1a0f00", display: "flex", gap: 10, alignItems: "center",
              }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(26,15,0,0.15)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 8, height: 2, background: "#1a0f00", opacity: 0.4 }} />
                </div>
                {item}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, fontSize: 22, fontWeight: 900, color: "#1a0f00" }}>
            月20〜40時間の作業
          </div>
        </div>

        {/* Center arrow */}
        <div style={{ display: "flex", alignItems: "center", fontSize: 36, color: "#1a0f00", opacity: 0.25 }}>→</div>

        {/* After */}
        <div style={{ flex: 1, background: "#1a0f00", borderRadius: 18, padding: "28px 28px 24px", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fffd43", opacity: 0.4, marginBottom: 6 }}>LemonCake 導入後</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#fffd43", marginBottom: 20 }}>全部 自動</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
            {after.map((item, i) => (
              <div key={i} style={{
                background: "rgba(255,253,67,0.1)", borderRadius: 10, padding: "11px 16px",
                fontSize: 15, color: "#fffd43", display: "flex", gap: 10, alignItems: "center",
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", background: "#fffd43", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 900, color: "#1a0f00",
                }}>✓</div>
                {item}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, fontSize: 22, fontWeight: 900, color: "#fffd43" }}>
            月0時間
          </div>
        </div>
      </div>
    </div>
  );
}
