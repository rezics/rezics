/**
 * Fractional indexing for ShelfItem.position.
 *
 * A "position" is a string of base-62 digits (0-9, A-Z, a-z) that sorts
 * lexicographically. Between any two positions we can always produce a new
 * position strictly between them by extending one digit. When keys grow too
 * long, callers trigger a local `rebalance` to redistribute evenly.
 *
 * Alphabet is ordered so ASCII comparison matches index order.
 */

const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = ALPHABET.length;
const FIRST = ALPHABET[0]!;
const LAST = ALPHABET[BASE - 1]!;
const MID = ALPHABET[Math.floor(BASE / 2)]!;

function charIndex(c: string): number {
  const i = ALPHABET.indexOf(c);
  if (i < 0) throw new Error(`invalid position character: ${c}`);
  return i;
}

/**
 * Generate a position strictly between `a` and `b`.
 * - If both omitted: returns a middle-of-range key.
 * - If `a` omitted: returns a key before `b`.
 * - If `b` omitted: returns a key after `a`.
 *
 * Requires `a < b` lexicographically when both provided.
 */
export function generateBetween(a?: string, b?: string): string {
  if (a !== undefined && b !== undefined && a >= b) {
    throw new Error(`generateBetween: expected a < b, got a=${a} b=${b}`);
  }

  if (a === undefined && b === undefined) return MID;

  if (a === undefined) {
    // Need a key strictly less than b.
    return keyBefore(b!);
  }

  if (b === undefined) {
    // Need a key strictly greater than a.
    return keyAfter(a);
  }

  return midpoint(a, b);
}

function keyAfter(a: string): string {
  // Simplest: extend a with MID. "abc" -> "abcU" etc.
  // That produces a key strictly greater than "abc" because any 4-char key
  // starting with "abc" is > "abc". We use MID so subsequent keyAfter calls
  // have room on either side.
  //
  // But prefer to "increment" the last digit when room exists to keep keys short.
  const lastChar = a[a.length - 1]!;
  const lastIdx = charIndex(lastChar);
  if (lastIdx < BASE - 1) {
    return a.slice(0, -1) + ALPHABET[lastIdx + 1]!;
  }
  return a + MID;
}

function keyBefore(b: string): string {
  // Symmetric to keyAfter: produce a key strictly less than b.
  const firstChar = b[0]!;
  const firstIdx = charIndex(firstChar);
  if (firstIdx > 0 && b.length === 1) {
    return ALPHABET[firstIdx - 1]!;
  }
  // Try shortening by one char; if b = "abc", "ab" is less than it only when b != "ab" + FIRST...
  // Safer general approach: midpoint between "" effectively and b.
  return midpoint("", b);
}

function midpoint(a: string, b: string): string {
  // Find common prefix
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const prefix = a.slice(0, i);
  const ax = i < a.length ? charIndex(a[i]!) : 0;
  const bx = i < b.length ? charIndex(b[i]!) : BASE;

  if (bx - ax > 1) {
    const mid = Math.floor((ax + bx) / 2);
    return prefix + ALPHABET[mid]!;
  }

  // bx == ax + 1 or bx == ax (can't happen since common prefix checked).
  // Need to descend: keep a's next char, then find key after a's suffix.
  // New key starts with prefix + ALPHABET[ax]; remainder must be strictly > a's suffix.
  const headChar = ALPHABET[ax]!;
  const aTail = a.slice(i + 1);
  if (aTail.length === 0) {
    // a = prefix + headChar, b = prefix + ALPHABET[ax+1]...
    // insert prefix + headChar + MID which is > a and < b.
    return prefix + headChar + MID;
  }
  // Otherwise recursively find a key strictly greater than aTail (< +infinity).
  return prefix + headChar + keyAfter(aTail);
}

/**
 * Produce `n` evenly-spaced positions across the full range.
 *
 * Used both for the initial data-migration backfill and for the rebalance
 * triggered when keys grow too long in a dense window.
 */
export function rebalance(n: number): string[] {
  if (n <= 0) return [];
  if (n === 1) return [MID];

  // Fit n positions between FIRST+1 ("1") and LAST-1 ("y") using two-char keys,
  // falling back to three-char when n is large.
  const needed = n + 1; // we use slot indices 1..n (avoid endpoints 0 and max)
  let digits = 1;
  let capacity = BASE;
  while (capacity <= needed) {
    digits += 1;
    capacity *= BASE;
  }

  const keys: string[] = [];
  const step = Math.floor(capacity / (n + 1));
  for (let k = 1; k <= n; k++) {
    const value = k * step;
    keys.push(encodeInt(value, digits));
  }
  return keys;
}

function encodeInt(n: number, width: number): string {
  let out = "";
  let v = n;
  while (v > 0) {
    const d = v % BASE;
    out = ALPHABET[d]! + out;
    v = Math.floor(v / BASE);
  }
  return out.padStart(width, FIRST);
}

/**
 * Threshold above which `reorderItem` should trigger a local rebalance
 * instead of producing another long key.
 */
export const POSITION_LENGTH_THRESHOLD = 16;

/**
 * Export constants for tests / callers that need to know the range.
 */
export const POSITION_ALPHABET = ALPHABET;
export const POSITION_FIRST = FIRST;
export const POSITION_LAST = LAST;
