import {Elysia, t} from 'elysia';
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
import {
  BasicAdminPermission,
  hasPermissionToUpdateBook,
} from '@package/contract';
import type {Rating} from '@/prisma/client';
import {bookService} from './book.service';
import {mapBookToDTO} from './mapper';
import {unitService} from '@/src/unit/unit.service';
import {coreInstance} from '../core';
import {
  buildActorFromContext,
  identityContextPlugin,
  sessionContextPlugin,
} from '@/src/auth/context';

export const bookApi = coreInstance('/books')
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
      return bookService.getRatingByBookUnitId(params.unitId);
    },
    {
      params: bookParamsSchema,
      detail: {
        summary: 'Get rating',
      },
    },
  )
  .get(
    '/:unitId/chapterIndex',
    async ({params}): Promise<any> => {
      return bookService.getChapterIndexByBookUnitId(params.unitId);
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
  .use(
    new Elysia().use(sessionContextPlugin).get(
      '/',
      async ({query, currentUser, set}): Promise<BookListResponse> => {
        if (!BasicAdminPermission(currentUser)) {
          set.status = 403;
          throw new Error(
            'Forbidden: you do not have permission to get all books',
          );
        }
        const {books, total} = await bookService.list(query);
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
    ),
  )
  .use(
    new Elysia().use(identityContextPlugin).post(
      '/',
      async ({body, identity}): Promise<BookResponse> => {
        const bookReq: CreateBookInput = {
          userId: identity.unitId,
          ...body,
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
    ),
  )
  .use(
    new Elysia()
      .use(sessionContextPlugin)
      .put(
        '/:unitId',
        async ({
          params,
          body,
          identity,
          currentUser,
          set,
        }): Promise<BookResponse> => {
          const targetBookUnit = await unitService.getByUnitId(params.unitId);
          if (!targetBookUnit) {
            set.status = 404;
            throw new Error(`Book not found: ${params.unitId}`);
          }

          if (
            !hasPermissionToUpdateBook(
              buildActorFromContext({identity, currentUser}),
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
        async ({
          params,
          body,
          identity,
          currentUser,
          set,
        }): Promise<any> => {
          const targetBookUnit = await unitService.getByUnitId(params.unitId);
          if (!targetBookUnit) {
            set.status = 404;
            throw new Error(`Book not found: ${params.unitId}`);
          }

          if (
            !hasPermissionToUpdateBook(
              buildActorFromContext({identity, currentUser}),
              undefined,
              targetBookUnit as any,
            )
          ) {
            set.status = 403;
            throw new Error(
              'Forbidden: you do not have permission to update this book',
            );
          }

          return bookService.updateChapterIndex(params.unitId, body);
        },
        {
          params: bookParamsSchema,
          body: t.Any(),
          detail: {
            summary: 'Update book chapter index',
            description: 'Update the chapter index of a book by unit ID',
            tags: ['Books'],
          },
        },
      )
      .delete(
        '/:unitId',
        async ({
          params,
          identity,
          currentUser,
          set,
        }): Promise<{message: string}> => {
          if (!BasicAdminPermission(currentUser)) {
            set.status = 403;
            throw new Error(
              'Forbidden: you do not have permission to delete this book',
            );
          }

          const targetBookUnit = await unitService.getByUnitId(params.unitId);
          if (!targetBookUnit) {
            set.status = 404;
            throw new Error(`Book not found: ${params.unitId}`);
          }

          if (targetBookUnit.userId !== identity.unitId) {
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
      ),
  );
