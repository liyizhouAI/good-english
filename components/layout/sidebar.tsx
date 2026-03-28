"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  BookOpen,
  FileText,
  Import,
  Settings,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Smartphone,
  Monitor,
} from "lucide-react";
import { LogoBanner } from "@/components/ui/logo";
import { cn } from "@/lib/utils/cn";
import { useState, useEffect } from "react";
import { useViewMode } from "./view-mode-context";

const NAV_ITEMS = [
  { href: "/", labelCn: "仪表盘", icon: LayoutDashboard },
  { href: "/import", labelCn: "素材导入", icon: Import },
  { href: "/vocabulary", labelCn: "词汇", icon: BookOpen },
  { href: "/chat", labelCn: "AI 对话", icon: MessageSquare },
  { href: "/patterns", labelCn: "句型", icon: FileText },
  { href: "/settings", labelCn: "设置", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { viewMode, toggleViewMode } = useViewMode();
  const isMobile = viewMode === "mobile";

  useEffect(() => {
    setCollapsed(window.innerWidth < 768);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-12 flex items-center gap-3 px-4 bg-[var(--card)] border-b border-[var(--border)]">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-lg hover:bg-[var(--secondary)] text-[var(--foreground)] shrink-0"
        >
          <Menu className="h-5 w-5" />
        </button>
        {/* Logo: transparent, compact */}
        <LogoBanner />
      </div>

      {/* ── Mobile backdrop ── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "flex flex-col border-r border-[var(--border)] bg-[var(--card)] transition-all duration-200 z-50",
          "fixed md:relative inset-y-0 left-0 h-screen",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          collapsed ? "md:w-16" : "md:w-56",
          "w-56",
        )}
      >
        {/* ── Mobile close button (desktop hidden) ── */}
        <div className="md:hidden flex justify-end px-3 pt-2">
          <button
            className="p-1 rounded hover:bg-[var(--secondary)] text-[var(--muted-foreground)]"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav
          className={cn("flex-1 px-2 py-3 space-y-0.5", collapsed && "pt-4")}
        >
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.labelCn}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  collapsed ? "md:justify-center md:px-0" : "",
                  isActive
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "text-[var(--secondary-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.labelCn}</span>}
                {collapsed && <span className="md:hidden">{item.labelCn}</span>}
              </Link>
            );
          })}
        </nav>

        {/* ── Footer: view mode toggle + collapse toggle ── */}
        <div className="border-t border-[var(--border)] px-3 py-3 flex items-center justify-between">
          {/* Mobile/desktop view toggle (desktop only) */}
          <button
            onClick={toggleViewMode}
            className="hidden md:flex items-center justify-center p-1.5 rounded-lg hover:bg-[var(--secondary)] transition-colors"
            title={
              isMobile
                ? "切换到电脑端视图"
                : "切换到手机端视图 (iPhone 17 Pro Max)"
            }
            style={{
              color: isMobile ? "var(--primary)" : "var(--muted-foreground)",
            }}
          >
            {isMobile ? (
              <Smartphone className="h-4 w-4" />
            ) : (
              <Monitor className="h-4 w-4" />
            )}
          </button>
          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex items-center justify-center p-1.5 rounded-lg hover:bg-[var(--secondary)] text-[var(--muted-foreground)]"
            title={collapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
