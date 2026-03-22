export type WordCategory = 'daily' | 'business' | 'ai-tech' | 'custom';

export interface WordRecord {
  id: string;
  english: string;
  chinese: string;
  phonetic?: string;
  partOfSpeech: string;
  exampleSentence: string;
  exampleTranslation: string;
  context: string;
  category: WordCategory;
  tags: string[];
  sourceId?: string;
  // SM-2 spaced repetition
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: number;
  lastReviewedAt?: number;
  createdAt: number;
  updatedAt: number;
}
