/**
 * Generate hierarchical chapter data with valid UUIDv7 references.
 * 生成带有有效 UUIDv7 引用的分层章节数据。
 * @module ChapterGenerator
 */

import { faker } from "@faker-js/faker";

/**
 * Represents a single chapter node.
 * 表示单个章节节点。
 */
export interface Chapter {
  id: string;
  title: string;
  noContent: boolean;
}

/**
 * Represents the complete chapter tree structure.
 * 表示完整的章节树结构。
 */
export interface BookTocTree {
  chapters: Record<string, Chapter>;
  order: Record<string, string[]>;
}

/**
 * Generate a random tree of chapters similar to `miniChapterList`.
 * 生成一个类似 `miniChapterList` 的随机章节树。
 *
 * @param {number} topLevelCount - Number of top-level chapters. 顶层章节数量。
 * @param {number} minChildren - Minimum number of subchapters per top-level. 每个顶层章节的最少子章节数。
 * @param {number} maxChildren - Maximum number of subchapters per top-level. 每个顶层章节的最多子章节数。
 * @returns {BookTocTree} The generated tree structure. 生成的树结构。
 */
export function generateBookTocTree(
  topLevelCount: number = 3,
  minChildren: number = 5,
  maxChildren: number = 10,
): BookTocTree {
  const chapters: Record<string, Chapter> = {};
  const order: Record<string, string[]> = {};

  // Create top-level chapters
  // 创建顶层章节
  const topLevelIds: string[] = Array.from({ length: topLevelCount }).map(() =>
    faker.string.uuid(),
  );

  for (const parentId of topLevelIds) {
    chapters[parentId] = {
      id: parentId,
      title: faker.lorem.words({ min: 2, max: 4 }),
      noContent: true,
    };

    // Generate subchapters
    // 生成子章节
    const subCount = faker.number.int({ min: minChildren, max: maxChildren });
    const subIds: string[] = [];

    for (let i = 0; i < subCount; i++) {
      const childId = faker.string.uuid();
      chapters[childId] = {
        id: childId,
        title: faker.lorem.words({ min: 3, max: 6 }),
        noContent: faker.datatype.boolean({ probability: 0.2 }),
      };
      subIds.push(childId);
    }

    order[parentId] = subIds;
  }

  return { chapters, order };
}

/**
 * Example usage
 * 用法示例
 */
const exampleTree = generateBookTocTree(2, 3, 6);
console.log(JSON.stringify(exampleTree, null, 2));
