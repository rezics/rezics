import {env} from '../env';
import {
  AUTH_PRESENCE_COOKIE_MAX_AGE_SECONDS,
  AUTH_PRESENCE_COOKIE_NAME,
  AUTH_PRESENCE_COOKIE_VALUE,
} from '@package/contract';

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function isIpAddress(hostname: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':');
}

function deriveCookieDomain(hostname: string): string | null {
  if (LOCALHOST_HOSTS.has(hostname) || isIpAddress(hostname)) {
    return null;
  }

  const parts = hostname.split('.').filter(Boolean);
  if (parts.length <= 1) {
    return null;
  }

  if (
    parts.length >= 3 &&
    parts.at(-1)?.length === 2 &&
    parts.at(-2)?.length <= 3
  ) {
    return `.${parts.slice(-3).join('.')}`;
  }

  return `.${parts.slice(-2).join('.')}`;
}

function buildCookieAttributes(url: URL, maxAge: number): string[] {
  const attributes = [
    `${AUTH_PRESENCE_COOKIE_NAME}=${maxAge > 0 ? AUTH_PRESENCE_COOKIE_VALUE : ''}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'SameSite=Lax',
  ];

  const authBaseUrl = env.BETTER_AUTH_URL ?? url.origin;
  const domain = deriveCookieDomain(new URL(authBaseUrl).hostname);
  if (domain) {
    attributes.push(`Domain=${domain}`);
  }

  if (url.protocol === 'https:') {
    attributes.push('Secure');
  }

  return attributes;
}

export function buildAuthPresenceSetCookie(url: URL): string {
  return buildCookieAttributes(
    url,
    AUTH_PRESENCE_COOKIE_MAX_AGE_SECONDS,
  ).join('; ');
}

export function buildAuthPresenceClearCookie(url: URL): string {
  return buildCookieAttributes(url, 0).join('; ');
}
