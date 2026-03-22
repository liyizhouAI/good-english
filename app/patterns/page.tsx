'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAllPatterns, getDuePatterns } from '@/lib/db/patterns';
import { calculateSM2, qualityToNumber, type ReviewQuality } from '@/lib/utils/sm2';
import { db } from '@/lib/db/database';
import type { PatternRecord, PatternScenario } from '@/lib/types/pattern';
import { FileText, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type ScenarioFilter = 'all' | PatternScenario;

const SCENARIO_LABELS: Record<string, string> = {
  'all': '全部',
  'self-intro': '自我介绍',
  'ai-discussion': 'AI 讨论',
  'business': '商业交流',
  'social': '社交寒暄',
  'interview': '采访',
};

export default function PatternsPage() {
  const [patterns, setPatterns] = useState<PatternRecord[]>([]);
  const [duePatterns, setDuePatterns] = useState<PatternRecord[]>([]);
  const [scenario, setScenario] = useState<ScenarioFilter>('all');
  const [reviewMode, setReviewMode] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const loadData = useCallback(async () => {
    const [all, due] = await Promise.all([getAllPatterns(), getDuePatterns(50)]);
    setPatterns(all);
    setDuePatterns(due);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = scenario === 'all'
    ? patterns
    : patterns.filter(p => p.scenario === scenario);

  const currentCard = duePatterns[currentIndex];

  async function handleReview(quality: ReviewQuality) {
    if (!currentCard) return;
    const result = calculateSM2(
      qualityToNumber(quality),
      currentCard.easeFactor,
      currentCard.interval,
      currentCard.repetitions,
    );
    await db.patterns.update(currentCard.id, {
      ...result,
      lastReviewedAt: Date.now(),
      updatedAt: Date.now(),
    });

    if (currentIndex < duePatterns.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowAnswer(false);
    } else {
      setReviewMode(false);
      setCurrentIndex(0);
      setShowAnswer(false);
      await loadData();
    }
  }

  // Review mode
  if (reviewMode && currentCard) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">句型复习</h1>
          <span className="text-sm text-[var(--muted-foreground)]">
            {currentIndex + 1} / {duePatterns.length}
          </span>
        </div>

        <div
          className="relative rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 min-h-[280px] flex flex-col items-center justify-center cursor-pointer"
          onClick={() => setShowAnswer(!showAnswer)}
        >
          <p className="text-xl font-mono font-medium text-center">{currentCard.pattern}</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            {SCENARIO_LABELS[currentCard.scenario] || currentCard.scenario}
          </p>

          {showAnswer && (
            <div className="mt-6 text-center space-y-3 animate-in fade-in w-full">
              <p className="text-base text-[var(--secondary-foreground)]">{currentCard.patternChinese}</p>
              {currentCard.examples.map((ex, i) => (
                <div key={i} className="text-sm space-y-0.5">
                  <p className="italic">{ex.english}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{ex.chinese}</p>
                </div>
              ))}
            </div>
          )}

          <button
            className="absolute bottom-4 right-4 text-[var(--muted-foreground)]"
            onClick={e => { e.stopPropagation(); setShowAnswer(!showAnswer); }}
          >
            {showAnswer ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {showAnswer && (
          <div className="grid grid-cols-4 gap-2 mt-4">
            {([
              { quality: 'again' as ReviewQuality, label: 'Again', color: 'bg-red-500/10 text-red-400 border-red-500/30' },
              { quality: 'hard' as ReviewQuality, label: 'Hard', color: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
              { quality: 'good' as ReviewQuality, label: 'Good', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
              { quality: 'easy' as ReviewQuality, label: 'Easy', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
            ]).map(btn => (
              <button
                key={btn.quality}
                onClick={() => handleReview(btn.quality)}
                className={cn('rounded-lg border py-3 text-center text-sm font-medium transition-opacity hover:opacity-80', btn.color)}
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => { setReviewMode(false); setCurrentIndex(0); setShowAnswer(false); }}
          className="mt-4 w-full rounded-lg bg-[var(--secondary)] py-2 text-sm hover:bg-[var(--muted)]"
        >
          返回列表
        </button>
      </div>
    );
  }

  // List mode
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">句型训练</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {patterns.length} 个句型 · {duePatterns.length} 个待复习
          </p>
        </div>
        {duePatterns.length > 0 && (
          <button
            onClick={() => { setReviewMode(true); setCurrentIndex(0); setShowAnswer(false); }}
            className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <RotateCcw className="h-4 w-4" />
            复习 {duePatterns.length} 个
          </button>
        )}
      </div>

      {/* Scenario Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {(['all', 'self-intro', 'ai-discussion', 'business', 'social', 'interview'] as ScenarioFilter[]).map(s => (
          <button
            key={s}
            onClick={() => setScenario(s)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs whitespace-nowrap transition-colors',
              scenario === s
                ? 'bg-[var(--primary)] text-white'
                : 'bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--muted)]'
            )}
          >
            {SCENARIO_LABELS[s]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-12 text-center">
          <FileText className="h-8 w-8 mx-auto mb-3 text-[var(--muted-foreground)]" />
          <p className="text-[var(--muted-foreground)]">还没有句型</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">去「素材导入」页面添加内容，AI 会自动提取句型</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(pattern => {
            const isDue = pattern.nextReviewAt <= Date.now();
            return (
              <div
                key={pattern.id}
                className={cn(
                  'rounded-lg border p-4 transition-colors',
                  isDue ? 'border-amber-500/30 bg-amber-500/5' : 'border-[var(--border)] bg-[var(--card)]'
                )}
              >
                <p className="font-mono font-medium">{pattern.pattern}</p>
                <p className="text-sm text-[var(--secondary-foreground)] mt-1">{pattern.patternChinese}</p>
                {pattern.examples.length > 0 && (
                  <p className="text-xs text-[var(--muted-foreground)] mt-2 italic">
                    e.g. {pattern.examples[0].english}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs rounded px-1.5 py-0.5 bg-[var(--secondary)]">
                    {SCENARIO_LABELS[pattern.scenario] || pattern.scenario}
                  </span>
                  {isDue && <span className="text-xs text-amber-400">待复习</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
