import { faker } from "@faker-js/faker";

/**
 * Random integer in `[minInclusive, maxInclusive]`.
 * `[minInclusive, maxInclusive]` 区间内的随机整数。
 */
export function randomInt(minInclusive: number, maxInclusive: number): number {
  return faker.number.int({ min: minInclusive, max: maxInclusive });
}

/**
 * Pareto-like power-law integer in `[min, max]`.
 * Larger alpha → heavier skew toward min.
 * `[min, max]` 区间内类帕累托幂律分布的随机整数。
 * alpha 越大 → 越偏向 min。
 */
export function powerLaw(min: number, max: number, alpha: number): number {
  if (max <= min) return min;
  const u = Math.random();
  const raw = min + (max - min) * u ** alpha;
  const rounded = Math.round(raw);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

/**
 * Random float in `[min, max]`.
 * `[min, max]` 区间内的随机浮点数。
 */
export function randomFloat(min: number, max: number): number {
  return faker.number.float({ min, max });
}

/**
 * Random boolean with configurable true-probability (default 0.5).
 * 可配置 true 概率（默认 0.5）的随机布尔值。
 */
export function randomBoolean(trueProbability = 0.5): boolean {
  return Math.random() < trueProbability;
}

/**
 * Pick exactly N items from an array.
 * 从数组中恰好选取 N 个元素。
 */
export function pickN<T>(items: readonly T[], n: number): T[] {
  return faker.helpers.arrayElements(items, { min: n, max: n });
}

/**
 * Username generator that ensures uniqueness across calls.
 * 确保多次调用间唯一性的用户名生成器。
 */
export function createUsernameGenerator() {
  const seen = new Set<string>();
  return function generateUsername(): string {
    const base = faker.internet.username().toLowerCase();
    if (!seen.has(base)) {
      seen.add(base);
      return base;
    }
    let i = 2;
    while (seen.has(`${base}${i}`)) i++;
    const name = `${base}${i}`;
    seen.add(name);
    return name;
  };
}
