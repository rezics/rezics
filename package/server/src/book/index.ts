/**
 * Books Service - Main exports
 *
 * This service manages book entities with full CRUD operations,
 * search, filtering, and relationship management.
 */

// API endpoints (automatically registered by Encore)
export { bookApi } from "./book.api";

// Service layer for internal use
export { BookService, bookService } from "./book.service";
// Utilities
export { mapBookToDTO } from "./mapper";
// Types for internal use
export type { BookWithRelations } from "./types";
