// Shared spaced-repetition types, constants, and utilities
// Used by WordDetail and ReviewMode — edit once, applies everywhere.

export type Rating = 'again' | 'hard' | 'good' | 'easy';
export type Usefulness = 1 | 2 | 3 | 4;

export interface Swap {
  original: string;
  improved: string;
  reason: string;
}

export interface Feedback {
  correct: boolean;
  meaningCorrection?: string | null;
  structureNote?: string | null;
  swaps: Swap[];
}

export const RATING_DAYS: Record<Rating, number> = { again: 1, hard: 3, good: 7, easy: 21 };
export const USEFULNESS_MULT: Record<number, number> = { 1: 1.5, 2: 1.0, 3: 0.7, 4: 2.5 };
export const USEFULNESS_LABELS: Record<Usefulness, string> = {
  1: 'Just know it',
  2: 'Sometimes',
  3: 'In the right context',
  4: 'Know it very well',
};

export function computeDays(rating: Rating, usefulness: number): number {
  return Math.round(RATING_DAYS[rating] * (USEFULNESS_MULT[usefulness] ?? 1.0));
}

type Part = { text: string; type: 'normal' | 'struck' | 'improved' };

export function renderSwappedSentence(sentence: string, swaps: Swap[]) {
  let remaining = sentence;
  const parts: Part[] = [];

  for (const swap of swaps) {
    const idx = remaining.toLowerCase().indexOf(swap.original.toLowerCase());
    if (idx === -1) continue;
    if (idx > 0) parts.push({ text: remaining.slice(0, idx), type: 'normal' });
    parts.push({ text: remaining.slice(idx, idx + swap.original.length), type: 'struck' });
    parts.push({ text: swap.improved, type: 'improved' });
    remaining = remaining.slice(idx + swap.original.length);
  }
  if (remaining) parts.push({ text: remaining, type: 'normal' });

  return (
    <span>
      {parts.map((p, i) =>
        p.type === 'struck' ? (
          <span key={i} className="line-through text-zinc-600">{p.text}</span>
        ) : p.type === 'improved' ? (
          <span key={i} className="text-zinc-100 font-medium"> {p.text}</span>
        ) : (
          <span key={i} className="text-zinc-500">{p.text}</span>
        )
      )}
    </span>
  );
}
