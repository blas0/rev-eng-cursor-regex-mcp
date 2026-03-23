import { describe, expect, it } from "vitest";
import { encodePostings, decodePostings } from "../../src/core/index/postings.js";
import { encodeLookup, findLookupRecords } from "../../src/core/index/lookupTable.js";

describe("index serialization", () => {
  it("round-trips posting lists", () => {
    const encoded = encodePostings([
      { docId: 2, positions: [1, 5, 9] },
      { docId: 7, positions: [2] },
    ]);

    expect(decodePostings(encoded)).toEqual([
      { docId: 2, positions: [1, 5, 9] },
      { docId: 7, positions: [2] },
    ]);
  });

  it("finds lookup records by hash", () => {
    const buffer = encodeLookup([
      { hashHex: "0000000000000001", offset: 0, length: 12 },
      { hashHex: "0000000000000002", offset: 12, length: 8 },
    ]);

    expect(findLookupRecords(buffer, "0000000000000002")).toEqual([
      { hashHex: "0000000000000002", offset: 12, length: 8 },
    ]);
  });
});
