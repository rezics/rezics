import { faker } from "@faker-js/faker";
import { randomInt } from "../random/index.ts";

export {
  getDescriptionPool,
  getSummaryPool,
  getTitlePool,
  type TextPool,
  type UnitTextType,
} from "./corpus/index.ts";
export { getFaker, LANG_DISTRIBUTION } from "./locale.ts";

/** Title-cased title with `[minWords, maxWords]` random words from `faker.lorem`. */
export function generateTitle(minWords = 3, maxWords = 7): string {
  const wordCount = randomInt(minWords, maxWords);
  return faker.lorem
    .words(wordCount)
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Paragraph with `[minSentences, maxSentences]` random sentences from `faker.lorem`. */
export function generateParagraph(minSentences = 2, maxSentences = 5): string {
  const sentenceCount = randomInt(minSentences, maxSentences);
  return faker.lorem.sentences(sentenceCount);
}
