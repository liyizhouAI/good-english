'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MessageSquare,
  BookOpen,
  FileText,
  Import,
  Settings,
  LayoutDashboard,
  Zap,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useState, useEffect } from 'react';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', labelCn: '仪表盘', icon: LayoutDashboard },
  { href: '/import', label: 'Import', labelCn: '素材导入', icon: Import },
  { href: '/vocabulary', label: 'Vocabulary', labelCn: '词汇', icon: BookOpen },
  { href: '/chat', label: 'AI Chat', labelCn: 'AI 对话', icon: MessageSquare },
  { href: '/patterns', label: 'Patterns', labelCn: '句型', icon: FileText },
  { href: '/settings', label: 'Settings', labelCn: '设置', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // 手机默认收起，桌面默认展开
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    setCollapsed(isMobile);
  }, []);

  // 路由变化时关闭手机菜单
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* 手机端顶部 bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3 bg-[var(--card)] border-b border-[var(--border)]">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-lg hover:bg-[var(--secondary)] text-[var(--foreground)]"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Zap className="h-5 w-5 text-[var(--primary)]" />
        <span className="text-base font-bold tracking-tight">Good English</span>
      </div>

      {/* 手机端遮罩 */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* 手机端抽屉 / 桌面端侧边栏 */}
      <aside
        className={cn(
          'flex flex-col border-r border-[var(--border)] bg-[var(--card)] transition-all duration-200 z-50',
          // 手机：fixed 抽屉
          'fixed md:relative inset-y-0 left-0 h-screen',
          // 手机开关
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          // 桌面宽度
          collapsed ? 'md:w-16' : 'md:w-64',
          // 手机固定宽度
          'w-64',
        )}
      >
        {/* Logo */}
        <div className={cn(
          'flex items-center border-b border-[var(--border)]',
          collapsed ? 'md:justify-center px-0 py-5' : 'gap-2 px-6 py-5'
        )}>
          <Zap className="h-6 w-6 text-[var(--primary)] shrink-0" />
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight">Good English</span>
          )}
          {/* 手机关闭按钮 */}
          <button
            className="md:hidden ml-auto mr-2 p-1 rounded hover:bg-[var(--secondary)]"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {NAV_ITEMS.map(item => {
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.labelCn}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                  collapsed ? 'md:justify-center md:px-0' : '',
                  isActive
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'text-[var(--secondary-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]'
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.labelCn}</span>}
                {/* 手机端始终显示文字 */}
                {collapsed && <span className="md:hidden">{item.labelCn}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer + 桌面收起按钮 */}
        <div className="border-t border-[var(--border)] px-3 py-4 flex items-center justify-between">
          {!collapsed && (
            <p className="text-xs text-[var(--muted-foreground)]">英语战斗力恢复系统</p>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex ml-auto items-center justify-center p-1.5 rounded-lg hover:bg-[var(--secondary)] text-[var(--muted-foreground)]"
            title={collapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>
    </>
  );
}
