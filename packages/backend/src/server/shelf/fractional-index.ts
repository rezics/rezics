/**
 * Fractional indexing for ShelfItem.position.
 * ShelfItem.position 的分数索引。
 *
 * A "position" is a string of base-62 digits (0-9, A-Z, a-z) that sorts
 * lexicographically. Between any two positions we can always produce a new
 * position strictly between them by extending one digit. When keys grow too
 * long, callers trigger a local `rebalance` to redistribute evenly.
 * “position” 是按字典序排序的 base-62 数字（0-9、A-Z、a-z）字符串。在任意两个
 * position 之间，总能通过扩展一位数字生成一个严格介于两者之间的新 position。
 * 当键变得过长时，调用方会触发局部 `rebalance` 以均匀重新分布。
 *
 * Alphabet is ordered so ASCII comparison matches index order.
 * 字母表的顺序使得 ASCII 比较与索引顺序一致。
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
 * 生成一个严格介于 `a` 和 `b` 之间的 position。
 * - If both omitted: returns a middle-of-range key.
 *   两者都省略：返回范围中点的键。
 * - If `a` omitted: returns a key before `b`.
 *   省略 `a`：返回排在 `b` 之前的键。
 * - If `b` omitted: returns a key after `a`.
 *   省略 `b`：返回排在 `a` 之后的键。
 *
 * Requires `a < b` lexicographically when both provided.
 * 当同时提供两者时，要求按字典序 `a < b`。
 */
export function generateBetween(a?: string, b?: string): string {
  if (a !== undefined && b !== undefined && a >= b) {
    throw new Error(`generateBetween: expected a < b, got a=${a} b=${b}`);
  }

  if (a === undefined && b === undefined) return MID;

  if (a === undefined) {
    // Need a key strictly less than b.
    // 需要一个严格小于 b 的键。
    return keyBefore(b!);
  }

  if (b === undefined) {
    // Need a key strictly greater than a.
    // 需要一个严格大于 a 的键。
    return keyAfter(a);
  }

  return midpoint(a, b);
}

function keyAfter(a: string): string {
  // Simplest: extend a with MID. "abc" -> "abcU" etc.
  // That produces a key strictly greater than "abc" because any 4-char key
  // starting with "abc" is > "abc". We use MID so subsequent keyAfter calls
  // have room on either side.
  // 最简单的做法：用 MID 扩展 a，例如 "abc" -> "abcU"。这会生成一个严格大于
  // "abc" 的键，因为任何以 "abc" 开头的 4 字符键都 > "abc"。使用 MID 是为了让
  // 后续的 keyAfter 调用在两侧都有空间。
  //
  // But prefer to "increment" the last digit when room exists to keep keys short.
  // 但在有空间时优先“递增”最后一位数字，以保持键较短。
  const lastChar = a[a.length - 1]!;
  const lastIdx = charIndex(lastChar);
  if (lastIdx < BASE - 1) {
    return a.slice(0, -1) + ALPHABET[lastIdx + 1]!;
  }
  return a + MID;
}

function keyBefore(b: string): string {
  // Symmetric to keyAfter: produce a key strictly less than b.
  // 与 keyAfter 对称：生成一个严格小于 b 的键。
  const firstChar = b[0]!;
  const firstIdx = charIndex(firstChar);
  if (firstIdx > 0 && b.length === 1) {
    return ALPHABET[firstIdx - 1]!;
  }
  // Try shortening by one char; if b = "abc", "ab" is less than it only when b != "ab" + FIRST...
  // Safer general approach: midpoint between "" effectively and b.
  // 尝试缩短一个字符；若 b = "abc"，则只有当 b != "ab" + FIRST 时 "ab" 才小于它……
  // 更安全的通用做法：取 "" 与 b 之间的中点。
  return midpoint("", b);
}

function midpoint(a: string, b: string): string {
  // Find common prefix
  // 查找公共前缀
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
  // bx == ax + 1 或 bx == ax（由于已检查公共前缀，后者不会发生）。
  // 需要下探：保留 a 的下一个字符，然后找到 a 后缀之后的键。
  // 新键以 prefix + ALPHABET[ax] 开头；其余部分必须严格 > a 的后缀。
  const headChar = ALPHABET[ax]!;
  const aTail = a.slice(i + 1);
  if (aTail.length === 0) {
    // a = prefix + headChar, b = prefix + ALPHABET[ax+1]...
    // insert prefix + headChar + MID which is > a and < b.
    // a = prefix + headChar，b = prefix + ALPHABET[ax+1]……
    // 插入 prefix + headChar + MID，它 > a 且 < b。
    return prefix + headChar + MID;
  }
  // Otherwise recursively find a key strictly greater than aTail (< +infinity).
  // 否则递归找到一个严格大于 aTail 的键（< +无穷）。
  return prefix + headChar + keyAfter(aTail);
}

/**
 * Produce `n` evenly-spaced positions across the full range.
 * 在整个范围内生成 `n` 个均匀分布的 position。
 *
 * Used both for the initial data-migration backfill and for the rebalance
 * triggered when keys grow too long in a dense window.
 * 既用于初始数据迁移的回填，也用于密集窗口中键变得过长时触发的重新平衡。
 */
export function rebalance(n: number): string[] {
  if (n <= 0) return [];
  if (n === 1) return [MID];

  // Fit n positions between FIRST+1 ("1") and LAST-1 ("y") using two-char keys,
  // falling back to three-char when n is large.
  // 用两字符键在 FIRST+1（"1"）和 LAST-1（"y"）之间放入 n 个 position，
  // 当 n 较大时回退到三字符键。
  const needed = n + 1; // we use slot indices 1..n (avoid endpoints 0 and max) — 使用槽位索引 1..n（避开端点 0 和最大值）
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
 * 超过此阈值后，`reorderItem` 应触发局部重新平衡，而不是再生成一个长键。
 */
export const POSITION_LENGTH_THRESHOLD = 16;

/**
 * Export constants for tests / callers that need to know the range.
 * 为需要了解范围的测试/调用方导出常量。
 */
export const POSITION_ALPHABET = ALPHABET;
export const POSITION_FIRST = FIRST;
export const POSITION_LAST = LAST;
