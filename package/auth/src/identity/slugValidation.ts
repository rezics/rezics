export type SlugValidationResult =
  | { ok: true; normalized: string }
  | { ok: false; reason: string };

const DEFAULT_RESERVED = [
  // roles / identities
  "admin",
  "administrator",
  "moderator",
  "staff",
  "support",
  "official",
  "system",
  "root",
  "owner",
  "security",
  // auth / account
  "login",
  "logout",
  "signin",
  "signup",
  "register",
  "account",
  "settings",
  "password",
  "oauth",
  "auth",
  // product / navigation
  "help",
  "docs",
  "blog",
  "news",
  "status",
  "about",
  "terms",
  "privacy",
  "contact",
  "pricing",
  "billing",
  // technical / routing
  "api",
  "graphql",
  "assets",
  "static",
  "cdn",
  "webhook",
  "callback",
  // special aliases
  "me",
  "you",
  "null",
  "undefined",
] as const;

const DEFAULT_RESERVED_SET: ReadonlySet<string> = new Set(DEFAULT_RESERVED);

export interface ValidateSlugOptions {
  minLen?: number; // default 6
  maxLen?: number; // default 32
  reserved?: ReadonlySet<string>; // default DEFAULT_RESERVED_SET
  trim?: boolean; // default true
}

export function validateSlug(
  input: string,
  opts: ValidateSlugOptions = {},
): SlugValidationResult {
  const minLen = opts.minLen ?? 6;
  const maxLen = opts.maxLen ?? 32;
  const reserved = opts.reserved ?? DEFAULT_RESERVED_SET;

  const s = opts.trim === false ? input : input.trim();
  if (s.length === 0) return { ok: false, reason: "empty" };

  const len = s.length;
  if (len < minLen)
    return {
      ok: false,
      reason: `too_short, at least ${minLen} characters long`,
    };
  if (len > maxLen)
    return {
      ok: false,
      reason: `too_long, at most ${maxLen} characters long`,
    };

  if (s.charCodeAt(0) === 45) return { ok: false, reason: "leading_hyphen" };
  if (s.charCodeAt(len - 1) === 45)
    return { ok: false, reason: "trailing_hyphen" };

  if (reserved.has(s)) return { ok: false, reason: "reserved" };

  let prevHyphen = false;
  for (let i = 0; i < len; i++) {
    const c = s.charCodeAt(i);

    if (c === 45) {
      if (prevHyphen) return { ok: false, reason: "double_hyphen" };
      prevHyphen = true;
      continue;
    }
    prevHyphen = false;

    // 0-9
    if (c >= 48 && c <= 57) continue;
    // a-z
    if (c >= 97 && c <= 122) continue;
    // A-Z
    if (c >= 65 && c <= 90) continue;

    return { ok: false, reason: "invalid_char" };
  }

  return { ok: true, normalized: s };
}
