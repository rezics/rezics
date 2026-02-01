/**
 * Book Feature - Unified Public API
 *
 * This module re-exports all book-related features (library, read, edit).
 * External consumers should import from this file or the specific sub-feature.
 *
 * @module feature/book
 */

export * from './library';
export * from './read';
export * from './edit';
