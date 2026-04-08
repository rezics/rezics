/**
 * Application error with an HTTP status code.
 * Thrown in API/service layers; caught by the global onError handler.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
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
