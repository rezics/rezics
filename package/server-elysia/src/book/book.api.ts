import {Elysia, t} from 'elysia';
import {
  bookListQuerySchema,
  bookParamsSchema,
  createBookSchema,
  updateBookSchema,
} from '@package/contract';
import type {
  BookListQuery,
  BookListResponse,
  BookResponse,
  CreateBookInput,
  UpdateBookInput,
} from '@package/contract';
import {bookService} from './book.service';
import {mapBookToDTO} from './mapper';

import {coreInstance} from '../core';
/**
 * Book Controller - Elysia.js routes
 * Get all books with filters and pagination
 * GET /books?q=search&tag=fiction&page=1&limit=20
 */
export const bookApi = coreInstance('/books')
  .get(
    '/',
    async ({query}): Promise<BookListResponse> => {
      const {books, total} = await bookService.list(query);
      return {books: books.map(mapBookToDTO), total};
    },
    {
      query: bookListQuerySchema,
      detail: {
        summary: 'Get all books',
        description: 'Get all books with filters and pagination',
        tags: ['Books'],
      },
    },
  )

  /**
   * Get book by unitId
   * GET /books/:unitId
   */
  .get(
    '/:unitId',
    async ({params}): Promise<BookResponse> => {
      const book = await bookService.getByUnitId(params.unitId);
      return mapBookToDTO(book);
    },
    {
      params: bookParamsSchema,
      detail: {
        summary: 'Get book',
        description: 'Get a single book by unit ID',
        tags: ['Books'],
      },
    },
  )

  /**
   * Create new book
   * POST /books
   */
  .post(
    '/',
    async ({body}): Promise<BookResponse> => {
      const bookReq: CreateBookInput = {
        userId: body.userId,
        title: body.title,
        authorIds: body.authorIds,
        coverUrl: body.coverUrl,
        isbn: body.isbn,
        chaptersIndex: body.chaptersIndex,
        extra: body.extra,
        description: body.description,
      };

      const book = await bookService.create(bookReq);
      return mapBookToDTO(book);
    },
    {
      body: createBookSchema,
      detail: {
        summary: 'Create book',
        description: 'Create a new book',
        tags: ['Books'],
      },
    },
  )

  /**
   * Update book
   * PUT /books/:unitId
   */
  .put(
    '/:unitId',
    async ({params, body}): Promise<BookResponse> => {
      const bookReq: UpdateBookInput = {
        title: body.title,
        authorIds: body.authorIds,
        coverUrl: body.coverUrl,
        isbn: body.isbn,
        chaptersIndex: body.chaptersIndex,
        extra: body.extra,
        description: body.description,
      };

      const book = await bookService.update(params.unitId, bookReq);
      return mapBookToDTO(book);
    },
    {
      params: bookParamsSchema,
      body: updateBookSchema,
      detail: {
        summary: 'Update book',
        description: 'Update an existing book by unit ID',
        tags: ['Books'],
      },
    },
  )

  /**
   * Delete book
   * DELETE /books/:unitId
   */
  .delete(
    '/:unitId',
    async ({params}): Promise<{message: string}> => {
      await bookService.delete(params.unitId);
      return {message: 'Book and related post deleted successfully'};
    },
    {
      params: bookParamsSchema,
      detail: {
        summary: 'Delete book',
        description: 'Delete a book and its related unit by unit ID',
        tags: ['Books'],
      },
    },
  );
