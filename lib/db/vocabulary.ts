import { db } from './database';
import { nanoid } from 'nanoid';
import { getDefaultSM2Fields } from '@/lib/utils/sm2';
import type { WordRecord, WordCategory } from '@/lib/types/vocabulary';

export async function addWord(
  word: Omit<WordRecord, 'id' | 'easeFactor' | 'interval' | 'repetitions' | 'nextReviewAt' | 'lastReviewedAt' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = Date.now();
  const id = nanoid();
  await db.words.add({
    ...word,
    id,
    ...getDefaultSM2Fields(),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function addWords(
  words: Array<Omit<WordRecord, 'id' | 'easeFactor' | 'interval' | 'repetitions' | 'nextReviewAt' | 'lastReviewedAt' | 'createdAt' | 'updatedAt'>>
): Promise<string[]> {
  const now = Date.now();
  const sm2 = getDefaultSM2Fields();
  const records = words.map(w => ({
    ...w,
    id: nanoid(),
    ...sm2,
    createdAt: now,
    updatedAt: now,
  }));
  await db.words.bulkAdd(records);
  return records.map(r => r.id);
}

export async function getWordsByCategory(category: WordCategory) {
  return db.words.where('category').equals(category).toArray();
}

export async function getDueWords(limit = 20) {
  return db.words
    .where('nextReviewAt')
    .belowOrEqual(Date.now())
    .limit(limit)
    .toArray();
}

export async function getAllWords() {
  return db.words.toArray();
}

export async function updateWord(id: string, updates: Partial<WordRecord>) {
  await db.words.update(id, { ...updates, updatedAt: Date.now() });
}

export async function deleteWord(id: string) {
  await db.words.delete(id);
}
