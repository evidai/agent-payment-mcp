// Screen 5 — 安全管理（誰でも理解できる版）
export default function Screen5() {
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
          AIのお金を、安全に管理する
        </div>
        <div style={{ fontSize: 18, color: "#1a0f00", opacity: 0.5 }}>
          「AIが暴走して大金を使ってしまう」という不安を、仕組みで解決します
        </div>
      </div>

      <div style={{ display: "flex", gap: 20, flex: 1 }}>
        {/* Left: safety features */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            {
              title: "使える金額に上限を設定",
              desc: "「1回のタスクで最大 $10 まで」など細かく設定。上限を超えた瞬間に自動でブロックします。",
              tag: "過剰請求ゼロ",
            },
            {
              title: "有効期限つきの使い捨てトークン",
              desc: "1タスクごとに発行・自動失効するので、万が一漏れても被害を最小化。カード情報を渡す必要なし。",
              tag: "情報漏洩リスクゼロ",
            },
            {
              title: "1クリックで即座に全停止",
              desc: "AIの動きがおかしいと思ったら、ダッシュボードのボタン1つですべての支払いを即停止できます。",
              tag: "緊急停止機能",
            },
          ].map((f, i) => (
            <div key={i} style={{
              background: "#1a0f00", borderRadius: 14, padding: "18px 22px",
              display: "flex", gap: 16, alignItems: "flex-start",
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#fffd43", marginBottom: 6 }}>{f.title}</div>
                <div style={{ fontSize: 14, color: "#fffd43", opacity: 0.6, lineHeight: 1.6 }}>{f.desc}</div>
              </div>
              <div style={{
                flexShrink: 0, background: "rgba(255,253,67,0.15)", borderRadius: 8,
                padding: "6px 12px", fontSize: 12, fontWeight: 700, color: "#fffd43", whiteSpace: "nowrap",
              }}>{f.tag}</div>
            </div>
          ))}
        </div>

        {/* Right: dashboard preview */}
        <div style={{
          flex: "0 0 400px", background: "#1a0f00", borderRadius: 18, padding: "24px 24px",
          display: "flex", flexDirection: "column", gap: 16,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fffd43", opacity: 0.5 }}>管理ダッシュボード</div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 10 }}>
            {[
              { label: "今日の支出", value: "$18.42" },
              { label: "上限まで", value: "$31.58" },
            ].map((s) => (
              <div key={s.label} style={{
                flex: 1, background: "rgba(255,255,255,0.07)", borderRadius: 10, padding: "12px 14px",
              }}>
                <div style={{ fontSize: 11, color: "#fffd43", opacity: 0.4, marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#fffd43" }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#fffd43", opacity: 0.4, marginBottom: 6 }}>
              <span>使用額</span><span>36.8%</span>
            </div>
            <div style={{ height: 8, background: "rgba(255,253,67,0.15)", borderRadius: 4 }}>
              <div style={{ width: "37%", height: "100%", background: "#fffd43", borderRadius: 4 }} />
            </div>
          </div>

          {/* Active tokens */}
          <div style={{ fontSize: 12, fontWeight: 700, color: "#fffd43", opacity: 0.4 }}>アクティブなAI</div>
          {["ChatGPT 連携", "画像生成AI", "データ取得API"].map((name, i) => (
            <div key={i} style={{
              background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "10px 14px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 14, color: "#fffd43" }}>{name}</span>
              <div style={{
                background: "rgba(255,253,67,0.15)", borderRadius: 6, padding: "4px 10px",
                fontSize: 12, fontWeight: 700, color: "#fffd43",
              }}>停止</div>
            </div>
          ))}

          {/* Kill switch */}
          <div style={{
            background: "#dc2626", borderRadius: 10, padding: "12px 18px", textAlign: "center",
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>全AIを即座に停止する</div>
            <div style={{ fontSize: 11, color: "#fca5a5", marginTop: 4 }}>緊急時 — 2クリックで確定</div>
          </div>
        </div>
      </div>
    </div>
  );
}
