import rarityTable from "../../assets/bigram-rarity.json" with { type: "json" };
import {
  DEFAULT_MAX_TERM_LENGTH,
  InspectTerm,
} from "../shared/types.js";

const MAX_FREQUENCY = 1_000_000;

/**
 * Return a deterministic weight for a bigram where rarer pairs produce larger weights.
 */
export function getBigramWeight(pair: string): number {
  const tableValue = (rarityTable as Record<string, number>)[pair];
  if (tableValue !== undefined) {
    return Math.max(1, MAX_FREQUENCY - tableValue);
  }

  const first = pair.codePointAt(0) ?? 0;
  const second = pair.codePointAt(1) ?? 0;
  const punctuationBonus = /[^a-zA-Z0-9]/.test(pair) ? 50_000 : 0;
  return 400_000 + punctuationBonus + ((first * 131 + second * 17) % 350_000);
}

function computeWeights(input: string): number[] {
  const weights: number[] = [];
  for (let index = 0; index < input.length - 1; index += 1) {
    weights.push(getBigramWeight(input.slice(index, index + 2)));
  }
  return weights;
}

function isValidSparseWindow(weights: number[], start: number, end: number): boolean {
  const leftEdge = weights[start];
  const rightEdge = weights[end - 2];
  let interiorMax = -1;
  for (let index = start + 1; index <= end - 3; index += 1) {
    interiorMax = Math.max(interiorMax, weights[index]);
  }
  return leftEdge > interiorMax && rightEdge > interiorMax;
}

/**
 * Emit every sparse n-gram window in the input up to the configured maximum term length.
 */
export function buildAllSparseTerms(
  input: string,
  maxTermLength = DEFAULT_MAX_TERM_LENGTH,
): InspectTerm[] {
  if (input.length < 2) {
    return [];
  }

  const weights = computeWeights(input);
  const terms: InspectTerm[] = [];
  for (let start = 0; start < input.length - 1; start += 1) {
    const maxEnd = Math.min(input.length, start + maxTermLength);
    for (let end = start + 2; end <= maxEnd; end += 1) {
      if (isValidSparseWindow(weights, start, end)) {
        terms.push({
          term: input.slice(start, end),
          start,
          end,
          weight: Math.max(weights[start], weights[end - 2]),
        });
      }
    }
  }

  return terms;
}

/**
 * Choose a deterministic minimal cover of sparse n-grams for a query string.
 */
export function buildCoveringSparseTerms(
  input: string,
  maxTermLength = DEFAULT_MAX_TERM_LENGTH,
): InspectTerm[] {
  const candidates = buildAllSparseTerms(input, maxTermLength);
  if (candidates.length === 0) {
    return [];
  }

  const n = input.length;
  const best: Array<{ count: number; score: number; path: InspectTerm[] } | null> = Array.from(
    { length: n + 1 },
    () => null,
  );
  best[0] = { count: 0, score: 0, path: [] };

  for (let position = 0; position <= n; position += 1) {
    const state = best[position];
    if (!state) {
      continue;
    }

    for (const term of candidates) {
      if (term.start > position || term.end <= position) {
        continue;
      }

      const nextPosition = term.end;
      const nextCount = state.count + 1;
      const nextScore = state.score + (term.end - term.start) * 1000 + (term.weight ?? 0);
      const nextPath = [...state.path, term];
      const current = best[nextPosition];
      if (
        current === null ||
        nextCount < current.count ||
        (nextCount === current.count && nextScore > current.score)
      ) {
        best[nextPosition] = {
          count: nextCount,
          score: nextScore,
          path: nextPath,
        };
      }
    }
  }

  return best[n]?.path ?? [];
}
