import type { ChronicleMemory, MemoryCategory } from '../types';
import { textSimilarityScore } from './textSimilarity';

// Cheap, deterministic first pass (Layer 1): finds existing memories that
// might describe the same underlying fact as `candidateText`, scoped to the
// same category to avoid cross-category false positives. Used to build a
// short "maybe-duplicate" shortlist BEFORE spending an LLM call on judging —
// if nothing scores above the threshold, there's nothing worth sending to
// the judge at all.
export function findSimilarMemories(
  existingMemories: ChronicleMemory[],
  candidateText: string,
  category: MemoryCategory,
  limit = 5
): ChronicleMemory[] {
  return existingMemories
    .filter((m) => m.category === category)
    .map((m) => ({ memory: m, score: textSimilarityScore(m.text, candidateText) }))
    .filter((x) => x.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.memory);
}
