import { RESERVED_SLUGS } from "./reserved";
import type { SlugScopeName } from "./scopes";

export type SlugValidationResult =
  | { ok: true; normalized: string }
  | { ok: false; reason: string };

export interface ValidateSlugOptions {
  /**
   * Scope key driving server-side uniqueness lookup against
   * `(slugScope, slug)`. The validator itself does NOT use this for
   * reserved-word selection — reserved words are unified into a single
   * flat list applied to every scope. The argument is accepted here so
   * callers can pass scope through one validation entry point.
   *
   * Accepts a named scope (`'user' | 'realm' | 'tag' | 'zone' | 'entity'`)
   * or an owner-unit-id string for owner-scoped sub-resources.
   */
  scope?: SlugScopeName | string;
  minLen?: number; // default 6
  maxLen?: number; // default 36
  reserved?: ReadonlySet<string>; // default RESERVED_SLUGS
}

export function validateSlug(
  input: string,
  opts: ValidateSlugOptions = {},
): SlugValidationResult {
  const minLen = opts.minLen ?? 6;
  const maxLen = opts.maxLen ?? 36;
  const reserved = opts.reserved ?? RESERVED_SLUGS;

  // trim + lowercase normalize
  const s = input.trim().toLowerCase();
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

    return { ok: false, reason: "invalid_char" };
  }

  return { ok: true, normalized: s };
}
