import { EncodedPosting } from "../shared/types.js";

/**
 * Serialize postings into a compact uint32 buffer using delta-encoded doc ids and positions.
 */
export function encodePostings(postings: EncodedPosting[]): Buffer {
  const values: number[] = [postings.length];
  let previousDocId = 0;

  for (const posting of postings.sort((left, right) => left.docId - right.docId)) {
    values.push(posting.docId - previousDocId);
    previousDocId = posting.docId;
    values.push(posting.positions.length);

    let previousPosition = 0;
    for (const position of posting.positions.sort((left, right) => left - right)) {
      values.push(position - previousPosition);
      previousPosition = position;
    }
  }

  const buffer = Buffer.allocUnsafe(values.length * 4);
  values.forEach((value, index) => buffer.writeUInt32BE(value >>> 0, index * 4));
  return buffer;
}

/**
 * Deserialize a postings slice from the on-disk buffer.
 */
export function decodePostings(buffer: Buffer): EncodedPosting[] {
  if (buffer.length === 0) {
    return [];
  }

  let offset = 0;
  const postingCount = buffer.readUInt32BE(offset);
  offset += 4;

  const postings: EncodedPosting[] = [];
  let previousDocId = 0;
  for (let postingIndex = 0; postingIndex < postingCount; postingIndex += 1) {
    previousDocId += buffer.readUInt32BE(offset);
    offset += 4;
    const positionCount = buffer.readUInt32BE(offset);
    offset += 4;

    const positions: number[] = [];
    let previousPosition = 0;
    for (let positionIndex = 0; positionIndex < positionCount; positionIndex += 1) {
      previousPosition += buffer.readUInt32BE(offset);
      offset += 4;
      positions.push(previousPosition);
    }

    postings.push({
      docId: previousDocId,
      positions,
    });
  }

  return postings;
}
