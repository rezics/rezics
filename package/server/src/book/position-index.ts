/**
 * Base36 fractional-index position generation for ContentStructureNode sibling
 * ordering. Sibling nodes (rows sharing the same `ownerUnitId` and `parentId`)
 * are ordered by lexicographic comparison of their `position`: appending yields
 * a key strictly greater than every existing sibling, and inserting yields a
 * key strictly between the two adjacent siblings — so reorder/insert touches a
 * single row's `position` and never its neighbors or descendants.
 *
 * 用于 ContentStructureNode 同级排序的 base36 分数索引位置生成。同级节点
 * （共享相同 `ownerUnitId` 和 `parentId` 的行）按其 `position` 的字典序比较
 * 排序：追加会生成一个严格大于所有现有同级的键，插入会生成一个严格介于两个
 * 相邻同级之间的键 — 因此重排/插入只会改动单行的 `position`，绝不影响其邻居
 * 或后代。
 *
 * This stays local instead of using the shelf base62 helper because historical
 * ContentStructure positions are base36 lowercase keys. Keeping the generator
 * stable avoids rewriting stored ordering values during the rename.
 *
 * 这里保持本地实现而非复用 shelf 的 base62 辅助函数，因为历史的
 * ContentStructure 位置是 base36 小写键。保持生成器稳定可避免在重命名期间
 * 重写已存储的排序值。
 *
 * Keys are strings of `[0-9a-z]`. Lexicographic comparison of these strings
 * determines sibling order. The alphabet is interpreted as base36 fractional
 * digits in the half-open interval [0, 1).
 *
 * 键是由 `[0-9a-z]` 组成的字符串。对这些字符串的字典序比较决定了同级顺序。
 * 字母表被解释为半开区间 [0, 1) 内的 base36 分数位。
 *
 * `between("", "g")` returns a key strictly less than `"g"`; `between("g", "")`
 * returns a key strictly greater than `"g"`. (Empty string is treated as the
 * open boundary for that side.)
 *
 * `between("", "g")` 返回一个严格小于 `"g"` 的键；`between("g", "")` 返回一个
 * 严格大于 `"g"` 的键。（空字符串被视为该侧的开放边界。）
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
 * 在字典序下返回一个严格介于 `prev` 与 `next` 之间的 base36 字符串。任一边界
 * 为 `null` 或 `""` 表示"开放" — 函数分别返回一个小于 `next` 或大于 `prev`
 * 的键。
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
  // 遍历两侧数位相等的共享前缀。
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
      // 取一个严格介于其间的数位。
      const mid = va + Math.floor((vb - va) / 2);
      result += digitChar(mid);
      return result;
    }

    // Adjacent digits: keep `a`'s digit and append something greater than the
    // tail of `a` (and, if applicable, smaller than the tail of `b`).
    // 相邻数位：保留 `a` 的数位，并追加一个大于 `a` 尾部（如适用，且小于
    // `b` 尾部）的内容。
    result += da;
    i++;
    // Now we need a key whose tail (from position i) is > a.slice(i) and
    // (only matters when b's prefix matched) < anything (b has already
    // diverged upward and is irrelevant beyond here).
    // 现在我们需要一个键，其尾部（从位置 i 起）> a.slice(i)，并且（只在 b
    // 的前缀已匹配时才重要）小于任何值（b 已向上分叉，超出此处后无关紧要）。
    while (true) {
      const ta = charAt(a, i);
      if (ta === LAST) {
        // Append 'z' and continue — we still need to produce something > ta.
        // 追加 'z' 并继续 — 我们仍需生成一个 > ta 的内容。
        result += LAST;
        i++;
        continue;
      }
      // ta < 'z' → insert a digit one step above ta, then we're done.
      // ta < 'z' → 插入一个比 ta 高一级的数位，随后即完成。
      result += digitChar(digitValue(ta) + 1);
      return result;
    }
  }
}

/**
 * The first key — used when inserting into an empty list of siblings.
 * 第一个键 — 用于插入到空的同级列表中。
 */
export function firstKey(): string {
  return MID_CHAR;
}

/**
 * Returns a key strictly greater than `prev`. Useful for appending a new
 * sibling at the end.
 * 返回一个严格大于 `prev` 的键。适用于在末尾追加一个新同级。
 */
export function keyAfter(prev: string | null | undefined): string {
  return between(prev ?? "", "");
}

/**
 * Returns a key strictly less than `next`. Useful for prepending a new
 * sibling at the start.
 * 返回一个严格小于 `next` 的键。适用于在开头前置一个新同级。
 */
export function keyBefore(next: string | null | undefined): string {
  return between("", next ?? "");
}
