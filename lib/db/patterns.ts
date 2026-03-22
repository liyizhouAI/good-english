import { db } from './database';
import { nanoid } from 'nanoid';
import { getDefaultSM2Fields } from '@/lib/utils/sm2';
import type { PatternRecord } from '@/lib/types/pattern';

export async function addPattern(
  pattern: Omit<PatternRecord, 'id' | 'easeFactor' | 'interval' | 'repetitions' | 'nextReviewAt' | 'lastReviewedAt' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = Date.now();
  const id = nanoid();
  await db.patterns.add({
    ...pattern,
    id,
    ...getDefaultSM2Fields(),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function addPatterns(
  patterns: Array<Omit<PatternRecord, 'id' | 'easeFactor' | 'interval' | 'repetitions' | 'nextReviewAt' | 'lastReviewedAt' | 'createdAt' | 'updatedAt'>>
): Promise<string[]> {
  const now = Date.now();
  const sm2 = getDefaultSM2Fields();
  const records = patterns.map(p => ({
    ...p,
    id: nanoid(),
    ...sm2,
    createdAt: now,
    updatedAt: now,
  }));
  await db.patterns.bulkAdd(records);
  return records.map(r => r.id);
}

export async function getAllPatterns() {
  return db.patterns.toArray();
}

export async function getDuePatterns(limit = 20) {
  return db.patterns
    .where('nextReviewAt')
    .belowOrEqual(Date.now())
    .limit(limit)
    .toArray();
}
