import { promises as fs } from "node:fs";

/**
 * Decide whether a file is likely plain text by looking for NUL bytes and control-character density.
 */
export function isLikelyText(buffer: Buffer): boolean {
  if (buffer.includes(0)) {
    return false;
  }

  let suspicious = 0;
  for (const byte of buffer) {
    if (byte < 9 || (byte > 13 && byte < 32)) {
      suspicious += 1;
    }
  }

  return suspicious / Math.max(buffer.length, 1) < 0.02;
}

/**
 * Read a UTF-8 file only when it appears to contain text content.
 */
export async function readTextFileIfLikelyText(filePath: string): Promise<string | null> {
  const buffer = await fs.readFile(filePath);
  if (!isLikelyText(buffer)) {
    return null;
  }

  return buffer.toString("utf8");
}
