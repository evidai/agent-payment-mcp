import type { Metadata } from "next";

// Founder Cockpit は private 用なので検索エンジン indexing を完全に遮断する。
export const metadata: Metadata = {
  title: "Founder Cockpit",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
    nocache: true,
    googleBot: { index: false, follow: false, "max-snippet": 0, "max-image-preview": "none" },
  },
};

export default function FounderLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
