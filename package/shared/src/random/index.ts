import { faker } from "@faker-js/faker";

/** Random integer in `[minInclusive, maxInclusive]`. */
export function randomInt(minInclusive: number, maxInclusive: number): number {
  return faker.number.int({ min: minInclusive, max: maxInclusive });
}

/**
 * Pareto-like power-law integer in `[min, max]`.
 * Larger alpha → heavier skew toward min.
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

/** Random float in `[min, max]`. */
export function randomFloat(min: number, max: number): number {
  return faker.number.float({ min, max });
}

/** Random boolean with configurable true-probability (default 0.5). */
export function randomBoolean(trueProbability = 0.5): boolean {
  return Math.random() < trueProbability;
}

/** Pick exactly N items from an array. */
export function pickN<T>(items: readonly T[], n: number): T[] {
  return faker.helpers.arrayElements(items, { min: n, max: n });
}

/** Username generator that ensures uniqueness across calls. */
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
