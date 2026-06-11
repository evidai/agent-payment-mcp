/* Shared visual layer for /about (JA) and /about/en — icons, animation CSS,
 * and editorial-design components. Both locale pages import from here so the
 * visual system can never drift between languages again (it did: the
 * editorial layer originally shipped JA-only). Copy/text stays per page. */

// ── SVG Icons（絵文字の代わりに統一線画アイコン。stroke=currentColor で文脈色に追従） ──
const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};
export const IconArrowRight = () => (
  <svg {...svgProps} strokeWidth={2} className="w-4 h-4">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);
export const IconCard = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <rect x="2" y="5" width="20" height="14" rx="3"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="10" y2="15"/>
  </svg>
);
export const IconBot = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <rect x="4" y="9" width="16" height="11" rx="2.5"/><line x1="12" y1="5.5" x2="12" y2="9"/><circle cx="12" cy="4" r="1.3"/>
    <line x1="9" y1="13.5" x2="9" y2="15"/><line x1="15" y1="13.5" x2="15" y2="15"/>
  </svg>
);
export const IconGear = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <circle cx="12" cy="12" r="3.2"/>
    <path d="M12 2.5v2.8M12 18.7v2.8M2.5 12h2.8M18.7 12h2.8M5.3 5.3l2 2M16.7 16.7l2 2M18.7 5.3l-2 2M7.3 16.7l-2 2"/>
  </svg>
);
export const IconTicket = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/>
    <path d="M13 5.5v2M13 11v2M13 16.5v2"/>
  </svg>
);
export const IconLock = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>
  </svg>
);
export const IconLink2 = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7"/>
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"/>
  </svg>
);
export const IconTag = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <path d="M3 3h8.2L21 12.8a2 2 0 0 1 0 2.8l-5.4 5.4a2 2 0 0 1-2.8 0L3 11.2z"/><circle cx="8" cy="8" r="1.6"/>
  </svg>
);
export const IconRocket = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <path d="M12 2.5c2.9 2.1 4.6 5.6 4.6 9.6 0 1.4-.3 2.9-.8 4.4H8.2c-.5-1.5-.8-3-.8-4.4 0-4 1.7-7.5 4.6-9.6z"/>
    <circle cx="12" cy="9.5" r="1.8"/>
    <path d="M7.6 14.5 5 19.5l3.6-1.2M16.4 14.5l2.6 5-3.6-1.2M12 18.5V22"/>
  </svg>
);
export const IconMeter = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <path d="M4 16a8 8 0 1 1 16 0"/><line x1="12" y1="16" x2="16.5" y2="11.5"/><circle cx="12" cy="16" r="1.2"/>
    <line x1="4" y1="19.5" x2="20" y2="19.5"/>
  </svg>
);
export const IconKey = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <circle cx="7.5" cy="15.5" r="3.8"/><path d="M10.5 12.5 20 3M17.5 5.5l2.5 2.5M14.5 8.5l2.5 2.5"/>
  </svg>
);
export const IconPayout = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <rect x="2" y="7" width="20" height="11" rx="2"/><circle cx="12" cy="12.5" r="2.6"/>
    <path d="M5.5 10v.01M18.5 15v.01"/>
  </svg>
);
export const IconBadge = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <rect x="3" y="5" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="11" r="2"/>
    <path d="M5.5 16.5c.7-1.5 1.7-2.2 3-2.2s2.3.7 3 2.2M14.5 9.5H19M14.5 13H19"/>
  </svg>
);
export const IconPlug = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <path d="M9 2.5V8M15 2.5V8M7 8h10v3.5a5 5 0 0 1-10 0z"/><line x1="12" y1="16.5" x2="12" y2="21.5"/>
  </svg>
);
export const IconStop = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <path d="M7.9 2.5h8.2l5.4 5.4v8.2l-5.4 5.4H7.9l-5.4-5.4V7.9z"/><line x1="12" y1="8" x2="12" y2="12.5"/><path d="M12 16h.01"/>
  </svg>
);
export const IconSteps = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <rect x="3" y="14" width="4.5" height="6.5" rx="1"/><rect x="9.75" y="9.5" width="4.5" height="11" rx="1"/><rect x="16.5" y="4.5" width="4.5" height="16" rx="1"/>
  </svg>
);
export const IconFlask = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <path d="M10 2.5v6L4.6 18.4A2 2 0 0 0 6.4 21.5h11.2a2 2 0 0 0 1.8-3.1L14 8.5v-6"/><path d="M8.5 2.5h7M7.2 15h9.6"/>
  </svg>
);
export const IconClock = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>
  </svg>
);


// ── CSS-only animations (no client JS; compositor-safe) ──
const ABOUT_CSS = `
@keyframes lcCoin { 0% { transform: translateX(0); opacity: 0; } 10% { opacity: 1; } 88% { opacity: 1; } 100% { transform: translateX(calc(100% - 10px)); opacity: 0; } }
@keyframes lcTicker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
@keyframes lcPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,253,67,0.35); } 50% { box-shadow: 0 0 0 10px rgba(255,253,67,0); } }
@keyframes lcFloat { 0%, 100% { transform: translateY(0) rotate(-8deg); } 50% { transform: translateY(-14px) rotate(8deg); } }
@keyframes lcStepPop { 0% { transform: scale(1); } 50% { transform: scale(1.12); } 100% { transform: scale(1); } }
@keyframes lcGrow { from { width: 0%; } }
@keyframes lcStamp { 0%, 86%, 100% { transform: rotate(-2deg) scale(1); } 92% { transform: rotate(-7deg) scale(1.12); } }
@keyframes lcShine { 0% { transform: translateX(-140%) skewX(-18deg); } 55%, 100% { transform: translateX(260%) skewX(-18deg); } }
.lc-coin { animation: lcCoin 3.2s linear infinite; will-change: transform, opacity; }
.lc-coin-dot { box-shadow: 0 0 8px rgba(255,253,67,0.8); }
.lc-ticker { animation: lcTicker 28s linear infinite; will-change: transform; }
.lc-cv { content-visibility: auto; contain-intrinsic-block-size: auto 1000px; }
.lc-pulse { animation: lcPulse 2.4s ease-in-out infinite; }
.lc-float { animation: lcFloat 5.5s ease-in-out infinite; }
.lc-grow { animation: lcGrow 1.8s cubic-bezier(.2,.8,.2,1) both; }
.lc-stamp { animation: lcStamp 4s ease-in-out infinite; }
.lc-shine { animation: lcShine 5.5s ease-in-out infinite; }
.lc-tilt { transition: transform .45s ease; transform-style: preserve-3d; transform: rotateY(-8deg) rotateX(4deg); }
.lc-tilt:hover { transform: rotateY(0deg) rotateX(0deg) translateY(-6px); }
@keyframes lcReveal { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: none; } }
@keyframes lcDrift { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(60px, -40px) scale(1.15); } }
@keyframes lcDrift2 { 0%, 100% { transform: translate(0, 0) scale(1.1); } 50% { transform: translate(-70px, 50px) scale(0.95); } }
.lc-aurora { animation: lcDrift 26s ease-in-out infinite; will-change: transform; }
.lc-aurora2 { animation: lcDrift2 34s ease-in-out infinite; will-change: transform; }
.lc-outline { color: transparent; -webkit-text-stroke: 1.5px rgba(255,255,255,0.07); user-select: none; }
.lc-outline-strong { color: transparent; -webkit-text-stroke: 1px rgba(255,253,67,0.4); }
@media (prefers-reduced-motion: no-preference) {
  @supports (animation-timeline: view()) {
    .lc-stagger > * { animation: lcReveal 1s linear both; animation-timeline: view(); animation-range: entry 0% entry 42%; }
  }
}
.lc-card { transition: transform .25s ease, border-color .25s ease, box-shadow .25s ease; }
.lc-card:hover { transform: translateY(-4px); border-color: rgba(255,253,67,0.35); box-shadow: 0 12px 32px rgba(0,0,0,0.45); }
.lc-step:hover .lc-step-emoji { animation: lcStepPop .45s ease; }
details.lc-faq > summary { list-style: none; cursor: pointer; }
details.lc-faq > summary::-webkit-details-marker { display: none; }
details.lc-faq > summary .lc-faq-chev { transition: transform .2s ease; }
details.lc-faq[open] > summary .lc-faq-chev { transform: rotate(90deg); }
@media (prefers-reduced-motion: reduce) { .lc-coin, .lc-ticker, .lc-pulse, .lc-float, .lc-grow, .lc-stamp, .lc-shine, .lc-aurora, .lc-aurora2 { animation: none; } .lc-card:hover { transform: none; } .lc-tilt, .lc-tilt:hover { transform: none; } }
`;

export function AboutStyles() {
  return <style dangerouslySetInnerHTML={{ __html: ABOUT_CSS }} />;
}

// slow drifting glow blobs behind the dark sections
export function AuroraBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="lc-aurora absolute -left-40 top-1/4 h-[55vh] w-[55vw] rounded-full bg-[#fffd43]/[0.05] blur-[110px]" />
      <div className="lc-aurora2 absolute -right-40 top-2/3 h-[45vh] w-[45vw] rounded-full bg-emerald-400/[0.04] blur-[110px]" />
    </div>
  );
}

// static film-grain texture overlay
const GRAIN_URL =
  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'160\' height=\'160\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'2\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")';
export function FilmGrain() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] opacity-[0.05]" style={{ backgroundImage: GRAIN_URL }} />
  );
}

// wavy section divider between the yellow band and the dark body
export function WaveDivider({ to }: { to: "dark" | "yellow" }) {
  return to === "dark" ? (
    <div className="bg-[#fffd43]" aria-hidden="true">
      <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className="block w-full h-[40px] md:h-[64px]">
        <path d="M0,32 C240,64 480,0 720,24 C960,48 1200,8 1440,32 L1440,64 L0,64 Z" fill="#06060a" />
      </svg>
    </div>
  ) : (
    <div className="bg-[#06060a]" aria-hidden="true">
      <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className="block w-full h-[40px] md:h-[64px]">
        <path d="M0,40 C240,8 480,56 720,32 C960,8 1200,56 1440,24 L1440,64 L0,64 Z" fill="#fffd43" />
      </svg>
    </div>
  );
}

// giant outlined word behind a section heading (editorial accent)
export function OutlineWord({ children, top = "top-2" }: { children: string; top?: string }) {
  return (
    <span aria-hidden="true" className={`lc-outline pointer-events-none absolute inset-x-0 ${top} text-center text-[88px] md:text-[150px] font-black leading-none whitespace-nowrap`}>
      {children}
    </span>
  );
}

// scrolling capability strip (language-neutral tech words)
const MARQUEE_WORDS = ["Pay-per-call", "HTTP 402", "Pay Token", "MCP Native", "97% to Sellers", "No Crypto Wallet", "x402 Gateway", "Sub-cent Pricing"];
export function MarqueeStrip() {
  return (
    <div className="overflow-hidden border-b border-white/5 py-3" aria-hidden="true">
      <div className="lc-ticker flex w-max items-center gap-10 px-4 font-black text-[12px] uppercase tracking-[0.3em] whitespace-nowrap">
        {[0, 1].map((dup) => (
          <div key={dup} className="flex items-center gap-10">
            {MARQUEE_WORDS.map((w, i) => (
              <span key={w} className={`flex items-center gap-10 ${i % 2 ? "text-white/20" : "lc-outline-strong"}`}>{w}<span className="text-[#fffd43]/35">●</span></span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
