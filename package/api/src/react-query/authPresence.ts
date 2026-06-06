import {
  AUTH_PRESENCE_COOKIE_NAME,
  AUTH_PRESENCE_COOKIE_VALUE,
} from "@rezics/contract";

function deriveCookieDomain(hostname: string): string | null {
  if (
    hostname === "localhost" ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) ||
    hostname.includes(":")
  ) {
    return null;
  }

  const parts = hostname.split(".").filter(Boolean);
  if (parts.length <= 1) {
    return null;
  }

  if (
    parts.length >= 3 &&
    parts.at(-1)?.length === 2 &&
    (parts.at(-2)?.length ?? Number.POSITIVE_INFINITY) <= 3
  ) {
    return `.${parts.slice(-3).join(".")}`;
  }

  return `.${parts.slice(-2).join(".")}`;
}

function readCookieString(): string {
  if (typeof document === "undefined") {
    return "";
  }

  return document.cookie ?? "";
}

export function getAuthPresenceCookieValue(): string | null {
  const cookieEntry = readCookieString()
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_PRESENCE_COOKIE_NAME}=`));

  if (!cookieEntry) {
    return null;
  }

  const [, value = ""] = cookieEntry.split("=");
  return value || null;
}

export function hasAuthPresence(): boolean {
  return getAuthPresenceCookieValue() === AUTH_PRESENCE_COOKIE_VALUE;
}

export function clearAuthPresence(): void {
  if (typeof document === "undefined") {
    return;
  }

  const domain = deriveCookieDomain(window.location.hostname);
  document.cookie = `${AUTH_PRESENCE_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${domain ? `; Domain=${domain}` : ""}`;
}
