/**
 * Error type used to communicate expected user-facing failures through the MCP layer.
 */
export class RegextoolError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "RegextoolError";
    this.code = code;
  }
}

/**
 * Convert an unknown thrown value into a stable Error instance.
 */
export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === "string" ? error : JSON.stringify(error));
}
