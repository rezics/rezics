import {t} from 'elysia';
import {coreInstance} from '../core';
import {tokenService} from './token.service';
import {
  bookParamsSchema,
  createBookSchema,
  updateBookSchema,
  type BookResponse,
} from '@package/contract';
import {bookService} from '../book/book.service';
import {unitService} from '../unit/unit.service';
import {
  hasPermissionToCreateBook,
  hasPermissionToReadBook,
  hasPermissionToUpdateBook,
} from './permission';

export const bookRoute = (api: ReturnType<typeof coreInstance>) => {
  return (
    api
      /**
       * Token-authenticated: Get book by unitId
       * GET /token/books/:unitId
       */
      .get(
        '/books/:unitId',
        async ({headers, set, params, request}): Promise<BookResponse> => {
          const ip =
            request.headers.get('x-forwarded-for') ??
            request.headers.get('x-real-ip') ??
            null;
          const userAgent = request.headers.get('user-agent') ?? null;

          const {scopes} = await tokenService.authenticateFromHeader(
            headers.authorization,
            {status: set.status as number | undefined},
            {ip, userAgent},
          );

          if (!hasPermissionToReadBook(scopes)) {
            set.status = 403;
            throw new Error('Forbidden: token does not have book:read scope');
          }

          const book = await bookService.getByUnitId(params.unitId);

          // Reuse existing DTO mapper through the book service index
          const {mapBookToDTO} = await import('../book/mapper');
          return mapBookToDTO(book as any);
        },
        {
          params: bookParamsSchema,
          headers: t.Object(
            {
              authorization: t.String(),
            },
            {
              additionalProperties: true, // 👈 允许任意 header 扩展
            },
          ),
          detail: {
            summary: 'Get book (token)',
            description:
              'Get a single book by unit ID using an API token instead of JWT auth',
            tags: ['Token', 'Books'],
          },
        },
      )

      /**
       * Token-authenticated: Create a book
       * POST /token/books
       */
      .post(
        '/books',
        async ({headers, set, body, request}): Promise<BookResponse> => {
          const ip =
            request.headers.get('x-forwarded-for') ??
            request.headers.get('x-real-ip') ??
            null;
          const userAgent = request.headers.get('user-agent') ?? null;

          const {userId, scopes} = await tokenService.authenticateFromHeader(
            headers.authorization,
            {status: set.status as number | undefined},
            {ip, userAgent},
          );

          if (!hasPermissionToCreateBook(scopes)) {
            set.status = 403;
            throw new Error('Forbidden: token does not have book:write scope');
          }

          // Force owner to be the token's user
          const created = await bookService.create({
            ...body,
            userId,
          } as any);

          const {mapBookToDTO} = await import('../book/mapper');
          return mapBookToDTO(created as any);
        },
        {
          body: createBookSchema,
          detail: {
            summary: 'Create book (token)',
            description:
              'Create a new book owned by the token user, authenticated via API token',
            tags: ['Token', 'Books'],
          },
        },
      )

      /**
       * Token-authenticated: Update a book
       * PUT /token/books/:unitId
       */
      .put(
        '/books/:unitId',
        async ({
          headers,
          set,
          params,
          body,
          request,
        }): Promise<BookResponse> => {
          const ip =
            request.headers.get('x-forwarded-for') ??
            request.headers.get('x-real-ip') ??
            null;
          const userAgent = request.headers.get('user-agent') ?? null;

          const {scopes} = await tokenService.authenticateFromHeader(
            headers.authorization,
            {status: set.status as number | undefined},
            {ip, userAgent},
          );

          if (!(await hasPermissionToUpdateBook(scopes))) {
            set.status = 403;
            throw new Error('Forbidden: token does not have book:write scope');
          }

          const updated = await bookService.update(params.unitId, body as any);
          const {mapBookToDTO} = await import('../book/mapper');
          return mapBookToDTO(updated as any);
        },
        {
          params: bookParamsSchema,
          body: updateBookSchema,
          detail: {
            summary: 'Update book (token)',
            description:
              'Update a book by unit ID using an API token, restricted to the token owner',
            tags: ['Token', 'Books'],
          },
        },
      )

      /**
       * Token-authenticated: Delete a book
       * DELETE /token/books/:unitId
       */
      .delete(
        '/books/:unitId',
        async ({headers, set, params, request}) => {
          set.status = 403;
          return {
            message: "Forbidden: now don't allow use token to delete book",
          };
          const ip =
            request.headers.get('x-forwarded-for') ??
            request.headers.get('x-real-ip') ??
            null;
          const userAgent = request.headers.get('user-agent') ?? null;

          const {userId, scopes} = await tokenService.authenticateFromHeader(
            headers.authorization,
            {status: set.status as number | undefined},
            {ip, userAgent},
          );

          if (
            !tokenService.hasAdminScope(scopes) &&
            !tokenService.hasScope(scopes, 'book', 'delete')
          ) {
            set.status = 403;
            throw new Error('Forbidden: token does not have book:delete scope');
          }

          const unit = await unitService.getByUnitId(params.unitId);
          if (!unit || unit.userId !== userId) {
            set.status = 403;
            throw new Error('Forbidden: token does not own this book');
          }

          await bookService.delete(params.unitId);
          return {message: 'Book and related post deleted successfully'};
        },
        {
          params: bookParamsSchema,
          detail: {
            summary: 'Delete book (token)',
            description:
              'Delete a book and its related unit by unit ID using an API token',
            tags: ['Token', 'Books'],
          },
        },
      )
  );
};
