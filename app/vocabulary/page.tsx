'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAllWords, getDueWords, updateWord, deleteWord } from '@/lib/db/vocabulary';
import { calculateSM2, qualityToNumber, type ReviewQuality } from '@/lib/utils/sm2';
import type { WordRecord, WordCategory } from '@/lib/types/vocabulary';
import { BookOpen, RotateCcw, Trash2, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type ViewMode = 'list' | 'review';
type CategoryFilter = 'all' | WordCategory;

export default function VocabularyPage() {
  const [words, setWords] = useState<WordRecord[]>([]);
  const [dueWords, setDueWords] = useState<WordRecord[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const loadData = useCallback(async () => {
    const [all, due] = await Promise.all([getAllWords(), getDueWords(50)]);
    setWords(all);
    setDueWords(due);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredWords = category === 'all'
    ? words
    : words.filter(w => w.category === category);

  const currentCard = dueWords[currentCardIndex];

  async function handleReview(quality: ReviewQuality) {
    if (!currentCard) return;
    const result = calculateSM2(
      qualityToNumber(quality),
      currentCard.easeFactor,
      currentCard.interval,
      currentCard.repetitions,
    );
    await updateWord(currentCard.id, {
      ...result,
      lastReviewedAt: Date.now(),
    });

    if (currentCardIndex < dueWords.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setShowAnswer(false);
    } else {
      setViewMode('list');
      setCurrentCardIndex(0);
      setShowAnswer(false);
      await loadData();
    }
  }

  async function handleDelete(id: string) {
    await deleteWord(id);
    await loadData();
  }

  const categories: { value: CategoryFilter; label: string }[] = [
    { value: 'all', label: `全部 (${words.length})` },
    { value: 'daily', label: '日常' },
    { value: 'business', label: '商业' },
    { value: 'ai-tech', label: 'AI/科技' },
    { value: 'custom', label: '自定义' },
  ];

  // Review Mode
  if (viewMode === 'review' && currentCard) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">词汇复习</h1>
          <span className="text-sm text-[var(--muted-foreground)]">
            {currentCardIndex + 1} / {dueWords.length}
          </span>
        </div>

        {/* Flashcard */}
        <div
          className="relative rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 min-h-[300px] flex flex-col items-center justify-center cursor-pointer"
          onClick={() => setShowAnswer(!showAnswer)}
        >
          <p className="text-3xl font-bold mb-2">{currentCard.english}</p>
          <p className="text-sm text-[var(--muted-foreground)]">{currentCard.partOfSpeech}</p>

          {showAnswer && (
            <div className="mt-6 text-center space-y-3 animate-in fade-in">
              <p className="text-xl">{currentCard.chinese}</p>
              <p className="text-sm italic text-[var(--secondary-foreground)]">
                {currentCard.exampleSentence}
              </p>
              {currentCard.exampleTranslation && (
                <p className="text-xs text-[var(--muted-foreground)]">
                  {currentCard.exampleTranslation}
                </p>
              )}
              <p className="text-xs text-[var(--muted-foreground)] mt-2">
                {currentCard.context}
              </p>
            </div>
          )}

          <button
            className="absolute bottom-4 right-4 text-[var(--muted-foreground)]"
            onClick={e => { e.stopPropagation(); setShowAnswer(!showAnswer); }}
          >
            {showAnswer ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {/* Rating Buttons */}
        {showAnswer && (
          <div className="grid grid-cols-4 gap-2 mt-4">
            {([
              { quality: 'again' as ReviewQuality, label: 'Again', sublabel: '重来', color: 'bg-red-500/10 text-red-400 border-red-500/30' },
              { quality: 'hard' as ReviewQuality, label: 'Hard', sublabel: '困难', color: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
              { quality: 'good' as ReviewQuality, label: 'Good', sublabel: '记住了', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
              { quality: 'easy' as ReviewQuality, label: 'Easy', sublabel: '简单', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
            ]).map(btn => (
              <button
                key={btn.quality}
                onClick={() => handleReview(btn.quality)}
                className={cn('rounded-lg border py-3 text-center transition-opacity hover:opacity-80', btn.color)}
              >
                <p className="text-sm font-medium">{btn.label}</p>
                <p className="text-xs opacity-70">{btn.sublabel}</p>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => { setViewMode('list'); setCurrentCardIndex(0); setShowAnswer(false); }}
          className="mt-4 w-full rounded-lg bg-[var(--secondary)] py-2 text-sm hover:bg-[var(--muted)]"
        >
          返回列表
        </button>
      </div>
    );
  }

  // List Mode
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">词汇恢复</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {words.length} 词已学 · {dueWords.length} 词待复习
          </p>
        </div>
        {dueWords.length > 0 && (
          <button
            onClick={() => { setViewMode('review'); setCurrentCardIndex(0); setShowAnswer(false); }}
            className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <RotateCcw className="h-4 w-4" />
            复习 {dueWords.length} 词
          </button>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {categories.map(cat => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs whitespace-nowrap transition-colors',
              category === cat.value
                ? 'bg-[var(--primary)] text-white'
                : 'bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--muted)]'
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Word List */}
      {filteredWords.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-12 text-center">
          <BookOpen className="h-8 w-8 mx-auto mb-3 text-[var(--muted-foreground)]" />
          <p className="text-[var(--muted-foreground)]">还没有词汇</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">去「素材导入」页面添加一些内容吧</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredWords.map(word => {
            const isDue = word.nextReviewAt <= Date.now();
            return (
              <div
                key={word.id}
                className={cn(
                  'flex items-center gap-4 rounded-lg border p-3 transition-colors',
                  isDue ? 'border-amber-500/30 bg-amber-500/5' : 'border-[var(--border)] bg-[var(--card)]'
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">{word.english}</span>
                    <span className="text-xs text-[var(--muted-foreground)]">({word.partOfSpeech})</span>
                    <span className="text-sm text-[var(--secondary-foreground)]">{word.chinese}</span>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5 truncate italic">
                    {word.exampleSentence}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs rounded px-1.5 py-0.5 bg-[var(--secondary)]">{word.category}</span>
                  {isDue && <span className="text-xs text-amber-400">待复习</span>}
                  <button
                    onClick={() => handleDelete(word.id)}
                    className="p-1 text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
