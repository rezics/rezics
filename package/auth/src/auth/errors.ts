export class AuthPolicyError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AuthPolicyError';
    this.status = status;
    this.code = code;
  }
}
