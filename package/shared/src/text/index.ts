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

/** Title-cased title with `[minWords, maxWords]` random words from `faker.lorem`. 来自 `faker.lorem` 的 `[minWords, maxWords]` 个随机词组成的首字母大写标题。 */
export function generateTitle(minWords = 3, maxWords = 7): string {
  const wordCount = randomInt(minWords, maxWords);
  return faker.lorem
    .words(wordCount)
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Paragraph with `[minSentences, maxSentences]` random sentences from `faker.lorem`. 来自 `faker.lorem` 的 `[minSentences, maxSentences]` 个随机句子组成的段落。 */
export function generateParagraph(minSentences = 2, maxSentences = 5): string {
  const sentenceCount = randomInt(minSentences, maxSentences);
  return faker.lorem.sentences(sentenceCount);
}
