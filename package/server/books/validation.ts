import type {BookCreateRequest, BookUpdateRequest} from './types';

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate book creation request
 */
export function validateCreateBook(req: BookCreateRequest): void {
  if (!req.userId || typeof req.userId !== 'string' || !req.userId.trim()) {
    throw new ValidationError('userId is required and must be a non-empty string');
  }

  if (!req.title || typeof req.title !== 'string' || !req.title.trim()) {
    throw new ValidationError('title is required and must be a non-empty string');
  }

  if (req.title.length > 500) {
    throw new ValidationError('title must be less than 500 characters');
  }

  if (req.isbn && typeof req.isbn === 'string') {
    const isbnClean = req.isbn.replace(/[-\s]/g, '');
    if (!/^\d{10}(\d{3})?$/.test(isbnClean)) {
      throw new ValidationError('isbn must be a valid ISBN-10 or ISBN-13 format');
    }
  }

  if (req.authorIds && (!Array.isArray(req.authorIds) || req.authorIds.some(id => typeof id !== 'string'))) {
    throw new ValidationError('authorIds must be an array of strings');
  }
}

/**
 * Validate book update request
 */
export function validateUpdateBook(req: BookUpdateRequest): void {
  if (req.title !== undefined) {
    if (typeof req.title !== 'string' || !req.title.trim()) {
      throw new ValidationError('title must be a non-empty string');
    }
    if (req.title.length > 500) {
      throw new ValidationError('title must be less than 500 characters');
    }
  }

  if (req.isbn !== undefined && req.isbn !== null && typeof req.isbn === 'string') {
    const isbnClean = req.isbn.replace(/[-\s]/g, '');
    if (!/^\d{10}(\d{3})?$/.test(isbnClean)) {
      throw new ValidationError('isbn must be a valid ISBN-10 or ISBN-13 format');
    }
  }

  if (req.authorIds !== undefined && (!Array.isArray(req.authorIds) || req.authorIds.some(id => typeof id !== 'string'))) {
    throw new ValidationError('authorIds must be an array of strings');
  }
}
