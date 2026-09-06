// Shared fuzzy text-matching used both for knowledge-graph node dedup
// (graphSync.ts) and flat-memory dedup (memoryDedup.ts) — the same
// underlying problem: does this new phrase describe the same thing as an
// existing one, despite different wording?

export function normalizeText(label: string): string {
  return label.trim().toLowerCase();
}

export function stripPunctuation(label: string): string {
  return normalizeText(label).replace(/[^a-z0-9\s]/g, '');
}

// Crude stemming — just enough to match "cupcakes"/"cupcake",
// "loves"/"love" — not linguistically rigorous, but cheap and good enough to
// stop simple pluralization/conjugation from defeating word-overlap matching.
function stem(word: string): string {
  // "ies" -> "y" is unambiguous (memory/memories, story/stories). Beyond
  // that, just strip a trailing "s" rather than also guessing at "es" —
  // most casual English plurals are silent-e + s (cake/cakes, love/loves),
  // not true "-es" (box/boxes), so a smarter "es" rule does more harm than
  // good here.
  if (word.length > 4 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

export function wordOverlapScore(a: string, b: string): number {
  const wordsA = new Set(stripPunctuation(a).split(/\s+/).filter((w) => w.length > 2).map(stem));
  const wordsB = new Set(stripPunctuation(b).split(/\s+/).filter((w) => w.length > 2).map(stem));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const w of wordsA) if (wordsB.has(w)) overlap++;
  return overlap / Math.min(wordsA.size, wordsB.size);
}

// 1.0 for an exact (normalized) match or substring containment either way,
// otherwise the word-overlap score (0..1).
export function textSimilarityScore(a: string, b: string): number {
  const strippedA = stripPunctuation(a);
  const strippedB = stripPunctuation(b);
  if (!strippedA || !strippedB) return 0;
  if (strippedA === strippedB || strippedA.includes(strippedB) || strippedB.includes(strippedA)) return 1;
  return wordOverlapScore(a, b);
}
