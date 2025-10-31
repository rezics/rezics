/**
 * Generate hierarchical chapter data with valid UUIDv7 references.
 * @module ChapterGenerator
 */

import {faker} from '@faker-js/faker';

/**
 * Represents a single chapter node.
 */
export interface Chapter {
  id: string;
  title: string;
  noContent: boolean;
}

/**
 * Represents the complete chapter tree structure.
 */
export interface ChapterTree {
  chapters: Record<string, Chapter>;
  order: Record<string, string[]>;
}

/**
 * Generate a random tree of chapters similar to `miniChapterList`.
 *
 * @param {number} topLevelCount - Number of top-level chapters.
 * @param {number} minChildren - Minimum number of subchapters per top-level.
 * @param {number} maxChildren - Maximum number of subchapters per top-level.
 * @returns {ChapterTree} The generated tree structure.
 */
export function generateChapterTree(
  topLevelCount: number = 3,
  minChildren: number = 5,
  maxChildren: number = 10,
): ChapterTree {
  const chapters: Record<string, Chapter> = {};
  const order: Record<string, string[]> = {};

  // Create top-level chapters
  const topLevelIds: string[] = Array.from({length: topLevelCount}).map(() =>
    faker.string.uuid(),
  );

  for (const parentId of topLevelIds) {
    chapters[parentId] = {
      id: parentId,
      title: faker.lorem.words({min: 2, max: 4}),
      noContent: true,
    };

    // Generate subchapters
    const subCount = faker.number.int({min: minChildren, max: maxChildren});
    const subIds: string[] = [];

    for (let i = 0; i < subCount; i++) {
      const childId = faker.string.uuid();
      chapters[childId] = {
        id: childId,
        title: faker.lorem.words({min: 3, max: 6}),
        noContent: faker.datatype.boolean({probability: 0.2}),
      };
      subIds.push(childId);
    }

    order[parentId] = subIds;
  }

  return {chapters, order};
}

/**
 * Example usage
 */
const exampleTree = generateChapterTree(2, 3, 6);
console.log(JSON.stringify(exampleTree, null, 2));
