export type UrlKind = "app-route" | "rezics" | "external" | "blocked";

export interface ClassifiedUrl {
  kind: UrlKind;
  href: string;
}

const BLOCKED_SCHEMES = new Set(["javascript:", "data:", "vbscript:"]);
const REZICS_DOMAIN = "rezics.com";

export function classifyUrl(raw: string): ClassifiedUrl {
  const trimmed = raw.trim();

  if (trimmed.startsWith("/") && /^\/[a-z0-9]/i.test(trimmed)) {
    return { kind: "app-route", href: trimmed };
  }

  const lower = trimmed.toLowerCase().replace(/^\s+/, "");
  for (const scheme of BLOCKED_SCHEMES) {
    if (lower.startsWith(scheme)) {
      return { kind: "blocked", href: "" };
    }
  }

  let url: URL;
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    url = new URL(withScheme);
  } catch {
    return { kind: "external", href: trimmed };
  }

  const host = url.hostname.toLowerCase();
  if (host === REZICS_DOMAIN || host.endsWith(`.${REZICS_DOMAIN}`)) {
    return { kind: "rezics", href: url.href };
  }

  return { kind: "external", href: url.href };
}
