/**
 * Book Library Feature - State Layer
 *
 * This module exports all jotai atoms and hooks for the book library feature.
 * External consumers should import from the feature's main index.ts, not directly from here.
 * 图书馆功能 - 状态层
 *
 * 本模块导出图书馆功能的所有 jotai atom 和 hook。
 * 外部消费方应从功能的主 index.ts 导入，而不要直接从这里导入。
 *
 * @module feature/book/library/state
 */

// Book detail atoms and types
// 书籍详情 atom 与类型
export {
  // Types
  // 类型
  type Book,
  type BookDetailLoadingState,
  // Atoms
  // 原子状态
  bookDetailAtomFamily,
  patchBookDetailAtomFamily,
  setBookDetailAtomFamily,
} from "./bookDetailAtoms";
