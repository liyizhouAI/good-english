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
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

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

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-[var(--border)] bg-[var(--card)]">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-[var(--border)]">
        <Zap className="h-6 w-6 text-[var(--primary)]" />
        <span className="text-lg font-bold tracking-tight">Good English</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(item => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'text-[var(--secondary-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]'
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.labelCn}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--border)] px-6 py-4">
        <p className="text-xs text-[var(--muted-foreground)]">
          英语战斗力恢复系统
        </p>
      </div>
    </aside>
  );
}
