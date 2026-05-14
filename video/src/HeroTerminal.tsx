import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { theme } from "./theme";

const C = {
  bgOuter: "#050505",
  bgWindow: "#0d0d0e",
  border: "rgba(255,255,255,0.06)",
  text: "#e6e6e6",
  muted: "#6e6e6e",
  comment: "#5a5a5a",
  prompt: "#8aff80",
  key: "#f0c674",
  bad: "#ff7b72",
  warn: "#f0c674",
  ready: "#79dac8",
  arrow: "#6e7681",
  accent: "#fff35a",
};

type Seg = { t: string; c?: string };
type Line = { start: number; cpf?: number; segs: Seg[] };

const CPF = 2;

const LINES: Line[] = [
  { start: 30,  segs: [{ t: "# Fresh terminal. No signup. No API keys.", c: C.comment }] },
  { start: 60,  segs: [{ t: "$ ", c: C.prompt }, { t: "npx -y lemon-cake-mcp" }] },
  { start: 95,  segs: [{ t: "[lemon-cake-mcp] ", c: C.arrow }, { t: "Starting..." }] },
  { start: 115, segs: [{ t: "PAY_TOKEN : ", c: C.key }, { t: "✗ not set", c: C.bad }] },
  { start: 128, segs: [{ t: "BUYER_JWT : ", c: C.key }, { t: "✗ not set", c: C.bad }] },
  { start: 141, segs: [{ t: "MODE      : ", c: C.key }, { t: "🎮 DEMO (no signup needed)", c: C.warn }] },
  { start: 165, segs: [{ t: "[lemon-cake-mcp] ", c: C.arrow }, { t: "Ready.", c: C.ready }] },
  { start: 190, segs: [{ t: "# Inside Claude Desktop, ask:", c: C.comment }] },
  { start: 210, segs: [{ t: "$ ", c: C.prompt }, { t: "Search Wikipedia for 'Model Context Protocol' via lemon-cake." }] },
  { start: 250, segs: [{ t: "→ ", c: C.arrow }, { t: "Claude picks " }, { t: "call_service(serviceId=demo_search)" }, { t: " ..." }] },
  { start: 275, segs: [
    { t: "→ ", c: C.arrow },
    { t: "200 OK", c: C.ready },
    { t: " · " },
    { t: "X-Amount-Usdc: 0.000100" },
    { t: " · " },
    { t: "X-Charge-Id: ch_8KqA…" },
  ]},
];

const lineLen = (line: Line) => line.segs.reduce((a, s) => a + [...s.t].length, 0);

const renderLine = (line: Line, frame: number) => {
  if (frame < line.start) return { jsx: null as React.ReactNode, visible: 0, done: false };
  const visible = Math.floor((frame - line.start) * (line.cpf ?? CPF));
  const total = lineLen(line);
  const show = Math.min(visible, total);
  let remaining = show;
  const out: React.ReactNode[] = [];
  line.segs.forEach((s, i) => {
    if (remaining <= 0) return;
    const chars = [...s.t];
    const take = Math.min(chars.length, remaining);
    out.push(
      <span key={i} style={{ color: s.c ?? C.text }}>{chars.slice(0, take).join("")}</span>
    );
    remaining -= take;
  });
  return { jsx: out, visible: show, done: visible >= total };
};

const Cursor: React.FC<{ frame: number }> = ({ frame }) => {
  const on = Math.floor(frame / 9) % 2 === 0;
  return (
    <span
      style={{
        display: "inline-block",
        width: 12,
        height: 26,
        verticalAlign: "middle",
        marginLeft: 3,
        background: C.text,
        opacity: on ? 0.9 : 0,
        borderRadius: 2,
      }}
    />
  );
};

export const HeroTerminal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const winOpacity = interpolate(frame, [0, 22], [0, 1], { extrapolateRight: "clamp" });
  const winScale = spring({
    frame,
    fps,
    from: 0.96,
    to: 1,
    durationInFrames: 32,
    config: { damping: 200 },
  });

  const activeIdx = (() => {
    for (let i = LINES.length - 1; i >= 0; i--) {
      if (frame >= LINES[i].start) return i;
    }
    return -1;
  })();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.bgOuter,
        fontFamily: theme.fontMono,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 1500,
          opacity: winOpacity,
          transform: `scale(${winScale})`,
          transformOrigin: "center center",
        }}
      >
        <div
          style={{
            background: C.bgWindow,
            border: `1px solid ${C.border}`,
            borderRadius: 20,
            boxShadow:
              "0 50px 120px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: 60,
              padding: "0 26px",
              borderBottom: `1px solid ${C.border}`,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.02), transparent)",
            }}
          >
            <div style={{ display: "flex", gap: 11 }}>
              <span style={{ width: 15, height: 15, borderRadius: 8, background: "#ff5f57" }} />
              <span style={{ width: 15, height: 15, borderRadius: 8, background: "#febc2e" }} />
              <span style={{ width: 15, height: 15, borderRadius: 8, background: "#28c840" }} />
            </div>
            <div
              style={{
                flex: 1,
                textAlign: "center",
                color: C.muted,
                fontSize: 17,
                letterSpacing: 0.4,
              }}
            >
              ~/projects · lemon-cake
            </div>
            <div style={{ width: 68 }} />
          </div>
          <div
            style={{
              padding: "40px 44px 56px",
              fontSize: 24,
              lineHeight: 1.7,
              color: C.text,
              minHeight: 760,
            }}
          >
            {LINES.map((line, i) => {
              if (frame < line.start) return null;
              const r = renderLine(line, frame);
              const isActive = i === activeIdx;
              return (
                <div key={i} style={{ whiteSpace: "pre", minHeight: 40 }}>
                  {r.jsx}
                  {isActive && <Cursor frame={frame} />}
                </div>
              );
            })}
          </div>
        </div>
        <div
          style={{
            marginTop: 22,
            textAlign: "center",
            color: C.muted,
            fontSize: 18,
          }}
        >
          ↑ live capture · this is what{" "}
          <span style={{ color: C.accent }}>`npx -y lemon-cake-mcp`</span>{" "}
          actually outputs
        </div>
      </div>
    </AbsoluteFill>
  );
};
