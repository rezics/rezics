/**
 * Book Library Feature - State Layer
 *
 * This module exports all jotai atoms and hooks for the book library feature.
 * External consumers should import from the feature's main index.ts, not directly from here.
 *
 * @module feature/book/library/state
 */

// Book detail atoms and types
export {
  // Types
  type Book,
  type BookDetailLoadingState,
  // Atoms
  bookDetailAtomFamily,
  setBookDetailAtomFamily,
  patchBookDetailAtomFamily,
} from './bookDetailAtoms';
