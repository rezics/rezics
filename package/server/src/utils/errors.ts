/**
 * Application error with an HTTP status code.
 * Thrown in API/service layers; caught by the global onError handler.
 *
 * `code` is a stable machine-readable identifier surfaced to clients so they can
 * branch UX (e.g., the `system_shelf_missing` recovery flow). `details` is an
 * optional structured payload merged into the JSON response.
 */
export interface AppErrorOptions {
  code?: string;
  details?: Record<string, unknown>;
}

export class AppError extends Error {
  public readonly code?: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    public readonly statusCode: number,
    message: string,
    options?: AppErrorOptions,
  ) {
    super(message);
    this.name = "AppError";
    this.code = options?.code;
    this.details = options?.details;
  }
}

export function forbidden(message: string): AppError {
  return new AppError(403, `Forbidden: ${message}`);
}

export function notFound(message: string): AppError {
  return new AppError(404, `${message} not found`);
}

export function unauthorized(message: string): AppError {
  return new AppError(401, `Unauthorized: ${message}`);
}
