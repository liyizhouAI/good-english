export type PatternScenario = 'self-intro' | 'ai-discussion' | 'business' | 'social' | 'interview';

export interface PatternExample {
  english: string;
  chinese: string;
}

export interface PatternRecord {
  id: string;
  pattern: string;
  patternChinese: string;
  scenario: PatternScenario;
  examples: PatternExample[];
  difficulty: 1 | 2 | 3;
  sourceId?: string;
  // SM-2
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: number;
  lastReviewedAt?: number;
  createdAt: number;
  updatedAt: number;
}
