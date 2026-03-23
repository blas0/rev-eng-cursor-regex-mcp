import { createHash } from "node:crypto";
import xxhash from "xxhash-wasm";

let xxhashApiPromise: ReturnType<typeof xxhash> | undefined;

function getXxhash() {
  xxhashApiPromise ??= xxhash();
  return xxhashApiPromise;
}

/**
 * Compute a stable 64-bit hash as a fixed-width hexadecimal string.
 */
export async function hash64Hex(input: string): Promise<string> {
  const api = await getXxhash();
  return api.h64ToString(input).padStart(16, "0");
}

/**
 * Compute a stable content hash suitable for file manifests and snapshot identities.
 */
export function hashContent(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Build a readable short identifier from a longer hash.
 */
export function shortHash(input: string, length = 12): string {
  return input.slice(0, length);
}

/**
 * Convert a 64-bit hexadecimal hash into a BigInt for binary search and sorting.
 */
export function hashHexToBigInt(hashHex: string): bigint {
  return BigInt(`0x${hashHex}`);
}

/**
 * Create a deterministic identifier that is safe to use in file-system paths.
 */
export function toSafeId(prefix: string, value: string): string {
  return `${prefix}-${shortHash(hashContent(value), 16)}`;
}
