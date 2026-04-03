import {atom} from 'jotai';
import {atomFamily} from 'jotai-family';

import type {BookDTO} from '@rezics/contract';

// ============================================================================
// Types
// ============================================================================

/** Canonical book type used throughout the library feature. */
export type Book = BookDTO;

/** Async data loading state for book detail. */
export type BookDetailLoadingState = 'idle' | 'loading' | 'ready' | 'error';

// ============================================================================
// Atoms - Book Detail Data
// ============================================================================

/**
 * Atom family for storing book detail data by bookId.
 * Returns null when no data is loaded yet.
 *
 * @example
 * const bookDetail = useAtomValue(bookDetailAtomFamily(bookId));
 */
export const bookDetailAtomFamily = atomFamily((bookId: string) => {
  return atom<Book | null>(null);
});

/**
 * Write-only atom for setting book detail data.
 * Use this to populate the atom after fetching from API.
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
 *
 * @example
 * const patchBookDetail = useSetAtom(patchBookDetailAtomFamily(bookId));
 * patchBookDetail({ description: newDescription });
 */
export const patchBookDetailAtomFamily = atomFamily((bookId: string) => {
  return atom(null, (get, set, patch: Partial<Book>) => {
    const prev = get(bookDetailAtomFamily(bookId));
    if (!prev) return;
    set(bookDetailAtomFamily(bookId), {...prev, ...patch});
  });
});

// ============================================================================
// Hooks - Convenience wrappers for external consumers
// ============================================================================

export {useAtomValue, useSetAtom} from 'jotai';
