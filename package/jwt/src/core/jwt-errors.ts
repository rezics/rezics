export class JwtVerificationError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'JwtVerificationError';
  }
}

export class JwtTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JwtTransportError';
  }
}
