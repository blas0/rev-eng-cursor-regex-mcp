import { promises as fs } from "node:fs";
import { buildAllSparseTerms } from "./sparseCovering.js";
import { getMaskedTrigrams, getTrigrams } from "./trigramExplain.js";
import {
  DEFAULT_MAX_TERM_LENGTH,
  InspectMode,
  InspectTermsResult,
} from "../shared/types.js";
import { RegextoolError } from "../shared/errors.js";

/**
 * Inspect the indexable terms emitted for a text snippet or source file.
 */
export async function inspectTerms(options: {
  path?: string;
  text?: string;
  mode: InspectMode;
  maxTerms?: number;
}): Promise<InspectTermsResult> {
  if ((options.path ? 1 : 0) + (options.text ? 1 : 0) !== 1) {
    throw new RegextoolError(
      "INVALID_INPUT",
      "Provide exactly one of `path` or `text` when inspecting terms.",
    );
  }

  const text = options.text ?? (await fs.readFile(options.path!, "utf8"));
  const maxTerms = options.maxTerms ?? 256;

  const terms = (() => {
    switch (options.mode) {
      case "sparse":
        return buildAllSparseTerms(text, DEFAULT_MAX_TERM_LENGTH);
      case "trigram":
        return getTrigrams(text);
      case "masked-trigram":
        return getMaskedTrigrams(text);
      default:
        return [];
    }
  })().slice(0, maxTerms);

  const notes: string[] = [];
  if (options.mode === "sparse") {
    notes.push(
      "Sparse mode emits variable-length n-grams whose edge bigrams outrank the bigrams inside the term.",
    );
  }
  if (options.mode === "masked-trigram") {
    notes.push(
      "Masked trigram mode aggregates location and follow-character masks per trigram to approximate phrase adjacency.",
    );
  }
  if (options.mode === "trigram") {
    notes.push("Classic trigram mode emits every overlapping 3-character window.");
  }

  return {
    mode: options.mode,
    termCount: terms.length,
    terms,
    notes,
  };
}
