'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Import, BookOpen, MessageSquare, FileText, ArrowRight } from 'lucide-react';
import { db } from '@/lib/db/database';

interface Stats {
  totalWords: number;
  dueWords: number;
  totalPatterns: number;
  duePatterns: number;
  totalMaterials: number;
  conversations: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalWords: 0, dueWords: 0, totalPatterns: 0,
    duePatterns: 0, totalMaterials: 0, conversations: 0,
  });

  useEffect(() => {
    async function loadStats() {
      const now = Date.now();
      const [totalWords, dueWords, totalPatterns, duePatterns, totalMaterials, conversations] =
        await Promise.all([
          db.words.count(),
          db.words.where('nextReviewAt').belowOrEqual(now).count(),
          db.patterns.count(),
          db.patterns.where('nextReviewAt').belowOrEqual(now).count(),
          db.materials.count(),
          db.conversations.count(),
        ]);
      setStats({ totalWords, dueWords, totalPatterns, duePatterns, totalMaterials, conversations });
    }
    loadStats();
  }, []);

  const quickActions = [
    {
      href: '/import',
      icon: Import,
      title: '导入素材',
      subtitle: 'Import Content',
      description: '粘贴推文、文章或 URL，AI 自动提取词汇和句型',
      stat: `${stats.totalMaterials} 篇素材`,
      color: 'text-emerald-400',
      bg: 'bg-emerald-400/10',
    },
    {
      href: '/vocabulary',
      icon: BookOpen,
      title: '词汇复习',
      subtitle: 'Vocabulary Review',
      description: '间隔重复复习，恢复核心词汇',
      stat: stats.dueWords > 0 ? `${stats.dueWords} 词待复习` : `${stats.totalWords} 词已学`,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
      badge: stats.dueWords > 0 ? stats.dueWords : undefined,
    },
    {
      href: '/chat',
      icon: MessageSquare,
      title: 'AI 对话',
      subtitle: 'AI Conversation',
      description: '模拟硅谷场景，与 AI 角色练习对话',
      stat: `${stats.conversations} 次对话`,
      color: 'text-violet-400',
      bg: 'bg-violet-400/10',
    },
    {
      href: '/patterns',
      icon: FileText,
      title: '句型训练',
      subtitle: 'Pattern Training',
      description: '掌握高频句型模板，提升表达流畅度',
      stat: stats.duePatterns > 0 ? `${stats.duePatterns} 个待复习` : `${stats.totalPatterns} 个句型`,
      color: 'text-amber-400',
      bg: 'bg-amber-400/10',
      badge: stats.duePatterns > 0 ? stats.duePatterns : undefined,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Good English</h1>
        <p className="mt-2 text-[var(--muted-foreground)]">
          英语战斗力恢复系统 — 从你的真实素材中学习，为硅谷对话做准备
        </p>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quickActions.map(action => (
          <Link
            key={action.href}
            href={action.href}
            className="group relative rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 transition-all hover:border-[var(--primary)]/50 hover:shadow-lg hover:shadow-[var(--primary)]/5"
          >
            {action.badge && (
              <span className="absolute top-4 right-4 flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--destructive)] px-2 text-xs font-bold text-white">
                {action.badge}
              </span>
            )}
            <div className={`inline-flex rounded-lg p-2.5 ${action.bg}`}>
              <action.icon className={`h-5 w-5 ${action.color}`} />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{action.title}</h3>
            <p className="text-xs text-[var(--muted-foreground)]">{action.subtitle}</p>
            <p className="mt-2 text-sm text-[var(--secondary-foreground)]">{action.description}</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-[var(--muted-foreground)]">{action.stat}</span>
              <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
