import { UnitType } from "../../../prisma/generated/client.js";

export {
  createUsernameGenerator,
  pickN,
  powerLaw,
  randomBoolean,
  randomFloat,
  randomInt,
} from "@rezics/shared/random";
export { generateParagraph, generateTitle } from "@rezics/shared/text";

export function unitTypeToShelfKind(type: UnitType): string {
  switch (type) {
    case UnitType.BOOK:
      return "book";
    case UnitType.GAME:
      return "game";
    case UnitType.MEDIA:
      return "media";
    case UnitType.POST:
      return "post";
    case UnitType.TAG:
      return "tag";
    case UnitType.REALM:
      return "realm";
    case UnitType.SHELF:
      return "shelf";
    case UnitType.IMAGE:
      return "image";
    case UnitType.VIDEO:
      return "video";
    case UnitType.QUOTE:
      return "quote";
    case UnitType.LINK:
      return "link";
    case UnitType.ENTITY:
      return "entity";
    case UnitType.ZONE:
      return "zone";
    default:
      return String(type).toLowerCase();
  }
}

/**
 * Run an async function over items in parallel chunks.
 * Keeps concurrent DB queries within connection pool limits.
 */
export async function chunkedParallel<T, R>(
  items: T[],
  chunkSize: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(
      chunk.map((item, j) => fn(item, i + j)),
    );
    results.push(...chunkResults);
  }
  return results;
}
