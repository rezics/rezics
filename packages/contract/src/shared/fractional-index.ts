/**
 * Shared fractional-index helper for position strings.
 *
 * A position is a base-62 string whose lexicographic comparison matches index
 * order. Keep this helper free of React, fetch, database, and app-runtime
 * dependencies so clients, contracts, and services can share the same ordering
 * behavior.
 */

const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = ALPHABET.length;
const MID = ALPHABET[Math.floor(BASE / 2)]!;

function charIndex(c: string): number {
  const i = ALPHABET.indexOf(c);
  if (i < 0) throw new Error(`invalid position character: ${c}`);
  return i;
}

function keyAfter(a: string): string {
  const lastChar = a[a.length - 1]!;
  const lastIdx = charIndex(lastChar);
  if (lastIdx < BASE - 1) {
    return a.slice(0, -1) + ALPHABET[lastIdx + 1]!;
  }
  return a + MID;
}

function keyBefore(b: string): string {
  const firstChar = b[0]!;
  const firstIdx = charIndex(firstChar);
  if (firstIdx > 0 && b.length === 1) {
    return ALPHABET[firstIdx - 1]!;
  }
  return midpoint("", b);
}

function midpoint(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  const prefix = a.slice(0, i);
  const ax = i < a.length ? charIndex(a[i]!) : 0;
  const bx = i < b.length ? charIndex(b[i]!) : BASE;

  if (bx - ax > 1) {
    const mid = Math.floor((ax + bx) / 2);
    return prefix + ALPHABET[mid]!;
  }

  const headChar = ALPHABET[ax]!;
  const aTail = a.slice(i + 1);
  if (aTail.length === 0) {
    return prefix + headChar + MID;
  }
  return prefix + headChar + keyAfter(aTail);
}

/**
 * Generate a position strictly between `a` and `b`. When both omitted,
 * returns a middle-of-range key. When only `b` is given, returns a key smaller
 * than `b`. When only `a` is given, returns a key larger than `a`.
 */
export function generateKeyBetween(a?: string, b?: string): string {
  if (a !== undefined && b !== undefined && a >= b) {
    throw new Error(`generateKeyBetween: expected a < b, got a=${a} b=${b}`);
  }
  if (a === undefined && b === undefined) return MID;
  if (a === undefined) return keyBefore(b!);
  if (b === undefined) return keyAfter(a);
  return midpoint(a, b);
}

/**
 * Compute the position to use when pinning a new item at the top of an
 * existing positioned list.
 */
export function positionForNewTopPin(firstExisting?: string | null): string {
  return generateKeyBetween(undefined, firstExisting ?? undefined);
}

/**
 * Compute the position to use when pinning a new item at the bottom of an
 * existing positioned list.
 */
export function positionForNewBottomPin(lastExisting?: string | null): string {
  return generateKeyBetween(lastExisting ?? undefined, undefined);
}

export const POSITION_ALPHABET = ALPHABET;
