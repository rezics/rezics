import type {JWTPayload, RefreshTokenPayload} from '@/src/user/types';
import bcrypt from 'bcrypt';

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

  if (typeof authorization != 'string') {
    set.status = 401;
    throw new Error('Unauthorized: Invalid authorization header');
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

/**
 * Hash password
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 11);
}

/**
 * Verify password
 */
export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return await bcrypt.compare(password, passwordHash);
}
