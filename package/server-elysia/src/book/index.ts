/**
 * Books Service - Main exports
 *
 * This service manages book entities with full CRUD operations,
 * search, filtering, and relationship management.
 */

// API endpoints (automatically registered by Encore)
export { bookApi } from './book.api';

// Service layer for internal use
export {bookService, BookService} from './book.service';

// Types for internal use
export type {BookWithRelations, BookFilterOptions} from './types';

// Utilities
export {sanitizeUser, mapBookToDTO} from './mapper';
export {
  validateCreateBook,
  validateUpdateBook,
  ValidationError,
} from './validation';
