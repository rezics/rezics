/**
 * Base36 fractional-index position generation for ContentStructureNode sibling
 * ordering. Sibling nodes (rows sharing the same `ownerUnitId` and `parentId`)
 * are ordered by lexicographic comparison of their `position`: appending yields
 * a key strictly greater than every existing sibling, and inserting yields a
 * key strictly between the two adjacent siblings — so reorder/insert touches a
 * single row's `position` and never its neighbors or descendants.
 *
 * This stays local instead of using the shelf base62 helper because historical
 * ContentStructure positions are base36 lowercase keys. Keeping the generator
 * stable avoids rewriting stored ordering values during the rename.
 *
 * Keys are strings of `[0-9a-z]`. Lexicographic comparison of these strings
 * determines sibling order. The alphabet is interpreted as base36 fractional
 * digits in the half-open interval [0, 1).
 *
 * `between("", "g")` returns a key strictly less than `"g"`; `between("g", "")`
 * returns a key strictly greater than `"g"`. (Empty string is treated as the
 * open boundary for that side.)
 */

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const BASE = ALPHABET.length;
const FIRST = "0";
const LAST = "z";
const MID_CHAR = ALPHABET[Math.floor(BASE / 2)]!; // "i"

function digitValue(ch: string): number {
  const idx = ALPHABET.indexOf(ch);
  if (idx < 0) throw new Error(`Invalid position digit: ${ch}`);
  return idx;
}

function digitChar(value: number): string {
  if (value < 0 || value >= BASE) {
    throw new Error(`Position digit out of range: ${value}`);
  }
  return ALPHABET[value]!;
}

function charAt(key: string, i: number): string {
  return i < key.length ? key[i]! : FIRST;
}

/**
 * Return a base36 string strictly between `prev` and `next` under
 * lexicographic ordering. `null` or `""` for either bound means "open" — the
 * function returns a key less than `next` or greater than `prev` respectively.
 */
export function between(
  prev: string | null | undefined,
  next: string | null | undefined,
): string {
  const a = prev ?? "";
  const b = next ?? "";

  if (a !== "" && b !== "" && a >= b) {
    throw new Error(
      `position.between: prev must be lexicographically less than next; got "${a}" / "${b}"`,
    );
  }

  let i = 0;
  let result = "";

  // Walk shared prefix where both digits are equal.
  while (true) {
    const da = charAt(a, i);
    const db = b === "" ? LAST : charAt(b, i);

    if (da === db) {
      result += da;
      i++;
      continue;
    }

    const va = digitValue(da);
    const vb = digitValue(db);

    if (vb - va > 1) {
      // Pick a digit strictly between.
      const mid = va + Math.floor((vb - va) / 2);
      result += digitChar(mid);
      return result;
    }

    // Adjacent digits: keep `a`'s digit and append something greater than the
    // tail of `a` (and, if applicable, smaller than the tail of `b`).
    result += da;
    i++;
    // Now we need a key whose tail (from position i) is > a.slice(i) and
    // (only matters when b's prefix matched) < anything (b has already
    // diverged upward and is irrelevant beyond here).
    while (true) {
      const ta = charAt(a, i);
      if (ta === LAST) {
        // Append 'z' and continue — we still need to produce something > ta.
        result += LAST;
        i++;
        continue;
      }
      // ta < 'z' → insert a digit one step above ta, then we're done.
      result += digitChar(digitValue(ta) + 1);
      return result;
    }
  }
}

/**
 * The first key — used when inserting into an empty list of siblings.
 */
export function firstKey(): string {
  return MID_CHAR;
}

/**
 * Returns a key strictly greater than `prev`. Useful for appending a new
 * sibling at the end.
 */
export function keyAfter(prev: string | null | undefined): string {
  return between(prev ?? "", "");
}

/**
 * Returns a key strictly less than `next`. Useful for prepending a new
 * sibling at the start.
 */
export function keyBefore(next: string | null | undefined): string {
  return between("", next ?? "");
}
