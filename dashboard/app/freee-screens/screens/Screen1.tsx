// Screen 1 — Hero: 一言で何ができるか
export default function Screen1() {
  return (
    <div style={{
      width: 1200, height: 630, background: "#fffd43",
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      padding: "56px 80px", boxSizing: "border-box",
      fontFamily: "'Hiragino Sans', 'Noto Sans JP', sans-serif",
      overflow: "hidden",
    }}>
      {/* Top */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, background: "#1a0f00", borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ width: 20, height: 20, background: "#fffd43", borderRadius: "50%" }} />
          </div>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#1a0f00" }}>LemonCake</span>
        </div>
        <div style={{
          background: "#1a0f00", borderRadius: 100, padding: "8px 22px",
          fontSize: 15, color: "#fffd43", fontWeight: 600,
        }}>freee 会計 連携アプリ</div>
      </div>

      {/* Big message */}
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1a0f00", opacity: 0.5, marginBottom: 16, letterSpacing: 1 }}>
          AI が外部サービスを使うたびに
        </div>
        <div style={{ fontSize: 72, fontWeight: 900, color: "#1a0f00", lineHeight: 1.1, marginBottom: 28 }}>
          支払いと仕訳が<br />自動で完結。
        </div>
        <div style={{ fontSize: 22, color: "#1a0f00", opacity: 0.6, lineHeight: 1.7 }}>
          AIに「使っていい金額」を渡すだけ。<br />
          決済・明細・freeeへの仕訳まで、人手ゼロで動き続けます。
        </div>
      </div>

      {/* 3 pillars */}
      <div style={{ display: "flex", gap: 16 }}>
        {[
          { num: "①", title: "上限を設定", desc: "AIが使える金額を事前に決める" },
          { num: "②", title: "AIが自動決済", desc: "外部APIを使うたびに自動で支払い" },
          { num: "③", title: "freeeに自動記帳", desc: "仕訳・源泉・インボイスまで全自動" },
        ].map((p) => (
          <div key={p.num} style={{
            flex: 1, background: "#1a0f00", borderRadius: 14, padding: "20px 22px",
          }}>
            <div style={{ fontSize: 13, color: "#fffd43", opacity: 0.45, marginBottom: 6 }}>{p.num}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fffd43", marginBottom: 6 }}>{p.title}</div>
            <div style={{ fontSize: 14, color: "#fffd43", opacity: 0.55 }}>{p.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
