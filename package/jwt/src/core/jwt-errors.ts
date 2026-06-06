export class JwtVerificationError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "JwtVerificationError";
  }
}

export class JwtTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JwtTransportError";
  }
}
