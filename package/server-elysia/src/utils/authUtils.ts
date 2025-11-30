import type {JWTPayload, RefreshTokenPayload} from '@/src/user/types';

type CommonPayload = JWTPayload | RefreshTokenPayload;

/**
 * Helper function to extract and verify JWT from Authorization header
 * */
export async function verifyAuth<T extends CommonPayload>(
  authorization: string | undefined,
  jwtInstance: any,
  set: any,
): Promise<T> {
  if (!authorization) {
    set.status = 401;
    throw new Error('Unauthorized: No authorization header provided');
  }

  // Extract token from "Bearer <token>" format
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : authorization;

  const payload = (await jwtInstance.verify(token)) as T | false;
  if (!payload) {
    set.status = 401;
    throw new Error('Unauthorized: Invalid token');
  }

  return payload;
}
