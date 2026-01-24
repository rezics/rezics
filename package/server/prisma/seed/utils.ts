import {faker} from '@faker-js/faker';

/**
 * Generate random integer within range (inclusive)
 * @param minInclusive - Minimum value
 * @param maxInclusive - Maximum value
 * @returns Random integer
 */
export function randomInt(minInclusive: number, maxInclusive: number): number {
  return faker.number.int({min: minInclusive, max: maxInclusive});
}

/**
 * Generate random float within range
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Random float
 */
export function randomFloat(min: number, max: number): number {
  return faker.number.float({min, max});
}

/**
 * Generate random boolean with configurable probability
 * @param trueProbability - Probability of true (0-1), defaults to 0.5
 * @returns Random boolean
 */
export function randomBoolean(trueProbability = 0.5): boolean {
  return Math.random() < trueProbability;
}

/**
 * Pick N random items from array
 * @param items - Array to pick from
 * @param n - Number of items to pick
 * @returns Array of picked items
 */
export function pickN<T>(items: readonly T[], n: number): T[] {
  return faker.helpers.arrayElements(items, {min: n, max: n});
}

/**
 * Create a username generator that ensures uniqueness
 * @returns Function that generates unique usernames
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

/**
 * Generate a title-cased title with random words
 * @param minWords - Minimum word count
 * @param maxWords - Maximum word count
 * @returns Generated title
 */
export function generateTitle(minWords = 3, maxWords = 7): string {
  const wordCount = randomInt(minWords, maxWords);
  return faker.lorem
    .words(wordCount)
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generate a paragraph with random sentences
 * @param minSentences - Minimum sentence count
 * @param maxSentences - Maximum sentence count
 * @returns Generated paragraph
 */
export function generateParagraph(minSentences = 2, maxSentences = 5): string {
  const sentenceCount = randomInt(minSentences, maxSentences);
  return faker.lorem.sentences(sentenceCount);
}
