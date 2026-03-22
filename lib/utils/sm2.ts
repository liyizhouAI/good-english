/**
 * SM-2 Spaced Repetition Algorithm
 * Quality ratings: 0-5
 *   0 = complete blackout
 *   1 = incorrect, but remembered upon seeing answer
 *   2 = incorrect, but answer seemed easy to recall
 *   3 = correct with serious difficulty
 *   4 = correct with some hesitation
 *   5 = perfect response
 *
 * Simplified to 4 buttons for UX:
 *   Again (0) | Hard (3) | Good (4) | Easy (5)
 */

export interface SM2Result {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: number;
}

export function calculateSM2(
  quality: number,
  currentEaseFactor: number,
  currentInterval: number,
  currentRepetitions: number,
): SM2Result {
  const now = Date.now();

  if (quality < 3) {
    // Failed: reset repetitions and interval
    return {
      easeFactor: Math.max(1.3, currentEaseFactor - 0.2),
      interval: 1,
      repetitions: 0,
      nextReviewAt: now + 1 * 24 * 60 * 60 * 1000, // 1 day
    };
  }

  // Passed: calculate new interval
  const newEaseFactor = Math.max(
    1.3,
    currentEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );

  let newInterval: number;
  const newRepetitions = currentRepetitions + 1;

  if (newRepetitions === 1) {
    newInterval = 1;
  } else if (newRepetitions === 2) {
    newInterval = 6;
  } else {
    newInterval = Math.round(currentInterval * newEaseFactor);
  }

  return {
    easeFactor: newEaseFactor,
    interval: newInterval,
    repetitions: newRepetitions,
    nextReviewAt: now + newInterval * 24 * 60 * 60 * 1000,
  };
}

export function getDefaultSM2Fields() {
  return {
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewAt: Date.now(),
    lastReviewedAt: undefined,
  };
}

export type ReviewQuality = 'again' | 'hard' | 'good' | 'easy';

export function qualityToNumber(quality: ReviewQuality): number {
  switch (quality) {
    case 'again': return 0;
    case 'hard': return 3;
    case 'good': return 4;
    case 'easy': return 5;
  }
}
