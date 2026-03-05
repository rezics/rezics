import type {Context} from 'elysia';
import {verifyBearerToken, type VerifyOptions} from '../jwt/verify';

export function createAuthGuard(options: VerifyOptions) {
  return async (context: Context): Promise<void> => {
    const authorization = context.request.headers.get('authorization') ?? undefined;

    try {
      const verified = await verifyBearerToken(authorization, options);
      (context as Context & {auth?: unknown}).auth = verified.payload;
    } catch {
      context.set.status = 401;
      throw new Error('Unauthorized');
    }
  };
}
