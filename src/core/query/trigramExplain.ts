import { InspectTerm } from "../shared/types.js";

/**
 * Emit overlapping trigrams for a literal string.
 */
export function getTrigrams(input: string): InspectTerm[] {
  const normalized = input;
  if (normalized.length < 3) {
    return [];
  }

  const terms: InspectTerm[] = [];
  for (let index = 0; index <= normalized.length - 3; index += 1) {
    terms.push({
      term: normalized.slice(index, index + 3),
      start: index,
      end: index + 3,
    });
  }

  return terms;
}

function setMaskBit(mask: number, bit: number): number {
  return mask | (1 << (bit % 8));
}

function nextMaskBit(character: string): number {
  const code = character.codePointAt(0) ?? 0;
  return code % 8;
}

/**
 * Aggregate trigram masks the same way the masked-trigram detour describes them in the blog.
 */
export function getMaskedTrigrams(input: string): InspectTerm[] {
  const terms = new Map<string, { start: number; end: number; locMask: number; nextMask: number }>();
  if (input.length < 3) {
    return [];
  }

  for (let index = 0; index <= input.length - 3; index += 1) {
    const trigram = input.slice(index, index + 3);
    const entry = terms.get(trigram) ?? {
      start: index,
      end: index + 3,
      locMask: 0,
      nextMask: 0,
    };
    entry.locMask = setMaskBit(entry.locMask, index % 8);
    if (index + 3 < input.length) {
      entry.nextMask = setMaskBit(entry.nextMask, nextMaskBit(input[index + 3] ?? ""));
    }
    terms.set(trigram, entry);
  }

  return [...terms.entries()].map(([term, entry]) => ({
    term,
    start: entry.start,
    end: entry.end,
    locMask: entry.locMask.toString(2).padStart(8, "0"),
    nextMask: entry.nextMask.toString(2).padStart(8, "0"),
  }));
}
