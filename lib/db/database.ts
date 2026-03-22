import Dexie, { type EntityTable } from 'dexie';
import type { WordRecord } from '@/lib/types/vocabulary';
import type { PatternRecord } from '@/lib/types/pattern';
import type { MaterialRecord } from '@/lib/types/material';
import type { ConversationRecord } from '@/lib/types/conversation';

export interface UserStatsRecord {
  id: string;
  wordsLearned: number;
  wordsReviewed: number;
  patternsLearned: number;
  patternsReviewed: number;
  conversationsCount: number;
  totalStudyMinutes: number;
  streakDays: number;
  date: string;
}

class GoodEnglishDB extends Dexie {
  words!: EntityTable<WordRecord, 'id'>;
  patterns!: EntityTable<PatternRecord, 'id'>;
  materials!: EntityTable<MaterialRecord, 'id'>;
  conversations!: EntityTable<ConversationRecord, 'id'>;
  userStats!: EntityTable<UserStatsRecord, 'id'>;

  constructor() {
    super('GoodEnglishDB');
    this.version(1).stores({
      words: 'id, category, nextReviewAt, [category+nextReviewAt], sourceId, *tags',
      patterns: 'id, scenario, nextReviewAt, [scenario+nextReviewAt], sourceId',
      materials: 'id, createdAt, *tags',
      conversations: 'id, scenario, createdAt',
      userStats: 'id, date',
    });
  }
}

export const db = new GoodEnglishDB();
