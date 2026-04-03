import {env} from '../env';

const devOrigins = [
  'http://localhost:35001',
  'http://localhost:35002',
  'http://localhost:8000',
];

const prodOrigins = ['https://book.rezics.com', 'https://rezics.com'];

const allowedOrigins = env.NODE_ENV === 'development' ? devOrigins : prodOrigins;

function normalizeOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

export const trustedOrigins = Array.from(
  new Set([
    env.BETTER_AUTH_URL,
    ...normalizeOrigins(env.AUTH_TRUSTED_ORIGINS),
    ...allowedOrigins,
  ]),
);

export const trustedOriginHosts = trustedOrigins
  .map(origin => {
    try {
      return new URL(origin).host;
    } catch {
      return null;
    }
  })
  .filter((host): host is string => !!host);

export function isTrustedOrigin(origin: string | null): boolean {
  if (!origin) {
    return false;
  }

  try {
    return trustedOriginHosts.includes(new URL(origin).host);
  } catch {
    return false;
  }
}
