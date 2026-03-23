import {
  AST,
  RegExpParser,
} from "@eslint-community/regexpp";
import { DEFAULT_MAX_CLASS_EXPANSION } from "../shared/types.js";
import { RegextoolError } from "../shared/errors.js";

export type RegexElement =
  | AST.Alternative["elements"][number]
  | AST.Group
  | AST.CapturingGroup
  | AST.Quantifier
  | AST.CharacterClass
  | AST.CharacterSet
  | AST.Character
  | AST.EdgeAssertion
  | AST.WordBoundaryAssertion;

export interface ParsedRegex {
  pattern: string;
  flags: string;
  ast: ReturnType<RegExpParser["parsePattern"]>;
}

/**
 * Parse and validate an ECMAScript regular expression using the published regexpp parser.
 */
export function parseRegex(pattern: string, flags = ""): ParsedRegex {
  try {
    // This throws on invalid flags or syntax and keeps our behavior aligned with JS runtime semantics.
    // eslint-disable-next-line no-new
    new RegExp(pattern, flags);
    const parser = new RegExpParser({ ecmaVersion: 2025 });
    const ast = parser.parsePattern(pattern, 0, pattern.length, {
      unicode: flags.includes("u"),
      unicodeSets: flags.includes("v"),
    });
    return { pattern, flags, ast };
  } catch (error) {
    throw new RegextoolError(
      "INVALID_REGEX",
      `Invalid ECMAScript regular expression: ${(error as Error).message}`,
    );
  }
}

function characterFromValue(value: number): string {
  return String.fromCodePoint(value);
}

/**
 * Expand a small literal character class so anchor extraction can stay precise without exploding branches.
 */
export function expandSmallCharacterClass(
  node: AST.CharacterClass,
  maxExpansion = DEFAULT_MAX_CLASS_EXPANSION,
): string[] | null {
  if (node.negate || node.unicodeSets) {
    return null;
  }

  const values: string[] = [];
  for (const element of node.elements) {
    if (element.type === "Character") {
      values.push(characterFromValue(element.value));
      continue;
    }

    if (element.type === "CharacterClassRange") {
      const rangeValues = expandCharacterRange(element, maxExpansion - values.length);
      if (rangeValues === null) {
        return null;
      }
      values.push(...rangeValues);
      continue;
    }

    return null;
  }

  const uniqueValues = [...new Set(values)];
  return uniqueValues.length <= maxExpansion ? uniqueValues : null;
}

function expandCharacterRange(
  range: AST.CharacterClassRange,
  maxExpansion: number,
): string[] | null {
  const start = range.min.value;
  const end = range.max.value;
  if (end < start || end - start + 1 > maxExpansion) {
    return null;
  }

  const values: string[] = [];
  for (let value = start; value <= end; value += 1) {
    if (value > 0x7f) {
      return null;
    }
    values.push(characterFromValue(value));
  }
  return values;
}
