import { describe, expect, it } from "vitest";
import { buildAllSparseTerms, buildCoveringSparseTerms } from "../../src/core/query/sparseCovering.js";

describe("sparse term extraction", () => {
  it("builds deterministic sparse terms for a literal string", () => {
    const first = buildAllSparseTerms("MAX_FILE_SIZE");
    const second = buildAllSparseTerms("MAX_FILE_SIZE");

    expect(first.length).toBeGreaterThan(0);
    expect(first).toEqual(second);
    expect(first.some((term) => term.term === "MA")).toBe(true);
  });

  it("builds a deterministic sparse covering", () => {
    const covering = buildCoveringSparseTerms("MAX_FILE_SIZE");

    expect(covering.length).toBeGreaterThan(0);
    expect(covering[0]?.start).toBe(0);
    expect(covering.at(-1)?.end).toBe("MAX_FILE_SIZE".length);
    expect(buildCoveringSparseTerms("MAX_FILE_SIZE")).toEqual(covering);
  });
});
