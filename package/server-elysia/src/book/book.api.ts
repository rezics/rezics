import {t} from 'elysia';
import {
  bookListQuerySchema,
  bookParamsSchema,
  createBookSchema,
  updateBookSchema,
} from '@package/contract';
import type {
  BookListResponse,
  BookResponse,
  CreateBookInput,
} from '@package/contract';
import {bookService} from './book.service';
import {mapBookToDTO} from './mapper';
import {unitService} from '@/src/unit/unit.service';
import {coreInstance} from '../core';
import {verifyAuth} from '@/src/user/utils';
import {
  hasPermissionToUpdateBook,
  BasicAdminPermission,
} from '@package/contract';
import type {Rating} from '@/prisma/client';

/**
 * Book Controller - Elysia.js routes
 * Get all books with filters and pagination
 * GET /books?q=search&tag=fiction&page=1&limit=20
 */
export const bookApi = coreInstance('/books')
  .get(
    '/',
    async ({query, headers, jwt, set}): Promise<BookListResponse> => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      if (!BasicAdminPermission(payload as any)) {
        set.status = 403;
        throw new Error(
          'Forbidden: you do not have permission to get all books',
        );
      }
      const {books, total} = await bookService.list(query);
      // return {books: books.map(mapBaseBookToDTO), total};
      return {books: books as any, total};
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

  .get(
    '/:unitId/rating',
    async ({params}): Promise<Rating> => {
      const rating = await bookService.getRatingByBookUnitId(params.unitId);
      return rating;
    },
    {
      params: bookParamsSchema,
      detail: {
        summary: 'Get rating',
      },
    },
  )

  /**
   * Get chapterIndex by bookUnitId
   * GET /books/:unitId/chapterIndex
   */
  .get(
    '/:unitId/chapterIndex',
    async ({params}): Promise<any> => {
      const chapterIndex = await bookService.getChapterIndexByBookUnitId(
        params.unitId,
      );
      return chapterIndex;
    },
    {
      params: bookParamsSchema,
      detail: {
        summary: 'Get chapterIndex',
        description: 'Get chapterIndex by bookUnitId',
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
    async ({body, headers, jwt, set}): Promise<BookResponse> => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const bookReq: CreateBookInput = {
        userId: payload.unitId,
        title: body.title,
        authorIds: body.authorIds,
        nsfw: body.nsfw,
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
   * NOTE Please provide only the keys that require updating. Otherwise, even if the string is empty, it will trigger a field update.
   */
  .put(
    '/:unitId',
    async ({params, body, headers, jwt, set}): Promise<BookResponse> => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const targetBookUnit = await unitService.getByUnitId(params.unitId);
      if (!targetBookUnit) {
        set.status = 404;
        throw new Error(`Book not found: ${params.unitId}`);
      }
      if (
        !hasPermissionToUpdateBook(
          payload as any,
          undefined,
          targetBookUnit as any,
        )
      ) {
        set.status = 403;
        throw new Error(
          'Forbidden: you do not have permission to update this book',
        );
      }
      const book = await bookService.update(params.unitId, body);
      console.log('book updated');
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

  .put(
    '/:unitId/chapterIndex',
    async ({params, body, headers, jwt, set}): Promise<any> => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const chapterIndex = await bookService.updateChapterIndex(
        params.unitId,
        body.chaptersIndex,
      );
      return chapterIndex;
    },
    {
      params: bookParamsSchema,
      body: t.Object({
        chaptersIndex: t.String(),
      }),
      detail: {
        summary: 'Update book chapter index',
        description: 'Update the chapter index of a book by unit ID',
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
    async ({params, headers, jwt, set}): Promise<{message: string}> => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const targetBookUnit = await unitService.getByUnitId(params.unitId);
      if (!targetBookUnit) {
        set.status = 404;
        throw new Error(`Book not found: ${params.unitId}`);
      }

      if (targetBookUnit.userId !== payload.unitId) {
        set.status = 403;
        throw new Error(
          'Forbidden: you do not have permission to delete this book',
        );
      }

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
