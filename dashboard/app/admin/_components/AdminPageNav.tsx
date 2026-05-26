"use client";

/**
 * /admin/* で共有するナビゲーション。
 *
 * 目的：今まで各ページが「← Admin Console」リンクしか持たず、
 * Funnel ↔ Telemetry ↔ Admin の往復が面倒だったのを解消する。
 *
 * 使い方:
 *   export default function MyAdminPage() {
 *     return (
 *       <AdminShell title="Conversion Funnel">
 *         <div>...page content...</div>
 *       </AdminShell>
 *     );
 *   }
 *
 * 認証チェックは各ページ側で従来通り行う。ここは純粋にレイアウト + ナビのみ。
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface NavItem {
  href:  string;
  label: string;
  desc:  string;
  icon:  string;
  group: "core" | "external";
  external?: boolean;
}

const ITEMS: NavItem[] = [
  { href: "/admin",           label: "管理コンソール", desc: "v2 全体ダッシュボード",         icon: "🛠️", group: "core" },
  { href: "/admin/funnel",    label: "ファネル",       desc: "DB 直結のコンバージョン漏斗",   icon: "📉", group: "core" },
  { href: "/admin/telemetry", label: "テレメトリ",     desc: "SDK / MCP family 利用集計",     icon: "📊", group: "core" },
  { href: "/",                label: "ユーザー側",     desc: "Buyer / Provider ダッシュ",     icon: "🏠", group: "external" },
  { href: "https://analytics.google.com", label: "GA4",  desc: "Google Analytics",            icon: "📈", group: "external", external: true },
  { href: "https://vercel.com/contact-2985s-projects/dashboard/analytics", label: "Vercel Analytics", desc: "Web Analytics", icon: "▲", group: "external", external: true },
];

interface AdminShellProps {
  title:    string;
  subtitle?: string;
  children: React.ReactNode;
}

export function AdminShell({ title, subtitle, children }: AdminShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // ESC + body scroll lock
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (href: string) => {
    if (href === pathname) return true;
    if (href === "/admin") return false;
    if (href.startsWith("http") || href === "/") return false;
    return pathname.startsWith(href);
  };

  function logout() {
    if (typeof window === "undefined") return;
    localStorage.removeItem("admin_token");
    window.location.href = "/admin/login";
  }

  const sidebar = (
    <aside className="w-[260px] sm:w-60 h-full flex flex-col bg-white border-r border-gray-200 flex-shrink-0">
      <div className="px-5 py-5 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="LemonCake" className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
          <div>
            <p className="text-gray-900 text-[13px] font-bold leading-tight">LemonCake</p>
            <p className="text-gray-400 text-[10px]">社内ツール</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto min-h-0">
        <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">管理ページ</p>
        <div className="space-y-1">
          {ITEMS.filter(i => i.group === "core").map(item => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
                  active ? "bg-amber-50 ring-1 ring-amber-200" : "hover:bg-gray-50"
                }`}
              >
                <span className={`text-lg leading-none flex-shrink-0 ${active ? "" : "opacity-70 group-hover:opacity-100"}`}>
                  {item.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-semibold leading-tight ${active ? "text-gray-900" : "text-gray-600 group-hover:text-gray-900"}`}>
                    {item.label}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5 truncate">{item.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>

        <p className="px-3 mt-6 mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">外部ツール</p>
        <div className="space-y-1">
          {ITEMS.filter(i => i.group === "external").map(item => (
            <a
              key={item.href}
              href={item.href}
              target={item.external ? "_blank" : undefined}
              rel={item.external ? "noopener noreferrer" : undefined}
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all group opacity-70 hover:opacity-100 hover:bg-gray-50"
            >
              <span className="text-base leading-none flex-shrink-0">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium leading-tight text-gray-600 group-hover:text-gray-900">
                  {item.label}
                  {item.external && <span className="ml-1 text-[10px] text-gray-400">↗</span>}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5 truncate">{item.desc}</p>
              </div>
            </a>
          ))}
        </div>
      </nav>

      <div className="px-3 py-3 border-t border-gray-100">
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12l3-4-3-4"/><path d="M13 8H5"/><path d="M7 14H3V2h4"/>
          </svg>
          ログアウト
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile backdrop */}
      <div
        onClick={() => setOpen(false)}
        className={`md:hidden fixed inset-0 bg-black/50 backdrop-blur-[2px] z-40 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        aria-hidden="true"
      />
      {/* Drawer */}
      <div
        role={open ? "dialog" : undefined}
        aria-modal={open || undefined}
        className={`fixed md:static inset-y-0 left-0 z-40 flex transform transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] shadow-2xl md:shadow-none ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="md:hidden absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 active:scale-95 transition"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/>
          </svg>
        </button>
        {sidebar}
      </div>

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-2 px-3 py-2.5 bg-white border-b border-gray-200 flex-shrink-0 sticky top-0 z-20">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-700 active:bg-gray-100 transition"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="17" y2="6"/><line x1="3" y1="10" x2="17" y2="10"/><line x1="3" y1="14" x2="17" y2="14"/>
            </svg>
          </button>
          <img src="/logo.png" alt="LemonCake" className="w-6 h-6 rounded-md object-cover flex-shrink-0" />
          <span className="font-semibold text-sm text-gray-900 truncate">{title}</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
