import {
  LOOKUP_RECORD_SIZE,
  LookupRecord,
} from "../shared/types.js";
import { hashHexToBigInt } from "../shared/hashing.js";

/**
 * Serialize lookup entries as fixed-width records for binary search in memory.
 */
export function encodeLookup(records: LookupRecord[]): Buffer {
  const sorted = [...records].sort((left, right) =>
    left.hashHex.localeCompare(right.hashHex),
  );
  const buffer = Buffer.allocUnsafe(sorted.length * LOOKUP_RECORD_SIZE);
  sorted.forEach((record, index) => {
    const offset = index * LOOKUP_RECORD_SIZE;
    buffer.writeBigUInt64BE(hashHexToBigInt(record.hashHex), offset);
    buffer.writeUInt32BE(record.offset >>> 0, offset + 8);
    buffer.writeUInt32BE(record.length >>> 0, offset + 12);
  });
  return buffer;
}

function readHash(buffer: Buffer, recordIndex: number): bigint {
  return buffer.readBigUInt64BE(recordIndex * LOOKUP_RECORD_SIZE);
}

function readRecord(buffer: Buffer, recordIndex: number): LookupRecord {
  const offset = recordIndex * LOOKUP_RECORD_SIZE;
  return {
    hashHex: buffer.readBigUInt64BE(offset).toString(16).padStart(16, "0"),
    offset: buffer.readUInt32BE(offset + 8),
    length: buffer.readUInt32BE(offset + 12),
  };
}

/**
 * Find all records that share a 64-bit term hash so collisions can remain false-positive-safe.
 */
export function findLookupRecords(buffer: Buffer, hashHex: string): LookupRecord[] {
  const recordCount = Math.floor(buffer.length / LOOKUP_RECORD_SIZE);
  if (recordCount === 0) {
    return [];
  }

  const target = hashHexToBigInt(hashHex);
  let low = 0;
  let high = recordCount - 1;
  let found = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const hash = readHash(buffer, mid);
    if (hash === target) {
      found = mid;
      break;
    }
    if (hash < target) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (found === -1) {
    return [];
  }

  let start = found;
  while (start > 0 && readHash(buffer, start - 1) === target) {
    start -= 1;
  }

  let end = found;
  while (end < recordCount - 1 && readHash(buffer, end + 1) === target) {
    end += 1;
  }

  const records: LookupRecord[] = [];
  for (let index = start; index <= end; index += 1) {
    records.push(readRecord(buffer, index));
  }
  return records;
}
