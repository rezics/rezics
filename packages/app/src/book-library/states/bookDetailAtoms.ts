import type { BookDTO } from "@rezics/contract";
import { atom } from "jotai";
import { atomFamily } from "jotai-family";

// ============================================================================
// Types
// 类型
// ============================================================================

/**
 * Canonical book type used throughout the library feature.
 * 整个 library 功能中使用的规范化 book 类型。
 */
export type Book = BookDTO;

/**
 * Async data loading state for book detail.
 * book 详情的异步数据加载状态。
 */
export type BookDetailLoadingState = "idle" | "loading" | "ready" | "error";

// ============================================================================
// Atoms - Book Detail Data
// Atoms - book 详情数据
// ============================================================================

/**
 * Atom family for storing book detail data by bookId.
 * Returns null when no data is loaded yet.
 * 按 bookId 存储 book 详情数据的 atom family。
 * 尚未加载任何数据时返回 null。
 *
 * @example
 * const bookDetail = useAtomValue(bookDetailAtomFamily(bookId));
 */
export const bookDetailAtomFamily = atomFamily((_bookId: string) => {
  return atom<Book | null>(null);
});

/**
 * Write-only atom for setting book detail data.
 * Use this to populate the atom after fetching from API.
 * 用于设置 book 详情数据的只写 atom。
 * 从 API 获取数据后用它来填充该 atom。
 *
 * @example
 * const setBookDetail = useSetAtom(setBookDetailAtomFamily(bookId));
 * setBookDetail(fetchedBook);
 */
export const setBookDetailAtomFamily = atomFamily((bookId: string) => {
  return atom(null, (_get, set, book: Book) => {
    set(bookDetailAtomFamily(bookId), book);
  });
});

/**
 * Write-only atom for partially updating book detail data.
 * Useful for optimistic UI updates (e.g., description edit).
 * 用于部分更新 book 详情数据的只写 atom。
 * 适用于乐观 UI 更新（例如编辑 description）。
 *
 * @example
 * const patchBookDetail = useSetAtom(patchBookDetailAtomFamily(bookId));
 * patchBookDetail({ description: newDescription });
 */
export const patchBookDetailAtomFamily = atomFamily((bookId: string) => {
  return atom(null, (get, set, patch: Partial<Book>) => {
    const prev = get(bookDetailAtomFamily(bookId));
    if (!prev) return;
    set(bookDetailAtomFamily(bookId), { ...prev, ...patch });
  });
});

// ============================================================================
// Atoms - Per-book Language Selection (ephemeral)
// Atoms - 每本 book 的语言选择（临时性）
// ============================================================================

/**
 * Atom family storing the user-selected language for a given book detail page.
 * `null` means no explicit choice yet — `useBookLanguage` resolves an initial
 * value from app locale, user preferences, and the book's available
 * translations on read.
 * 存储给定 book 详情页面上用户所选语言的 atom family。
 * `null` 表示尚无明确选择 —— `useBookLanguage` 会在读取时从 app locale、用户
 * 偏好以及该 book 可用的翻译中解析出初始值。
 */
export const bookLanguageAtom = atomFamily((_bookId: string) => {
  return atom<string | null>(null);
});

// ============================================================================
// Hooks - Convenience wrappers for external consumers
// Hooks - 面向外部消费者的便捷包装
// ============================================================================

export { useAtomValue, useSetAtom } from "jotai";
