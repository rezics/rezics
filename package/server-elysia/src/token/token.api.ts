import {t} from 'elysia';
import {coreInstance} from '../core';
import {verifyAuth} from '@/src/user/utils';
import {tokenService} from './token.service';
import {
  apiTokenDTOSchema,
  apiTokenListResponseSchema,
  createApiTokenSchema,
  createApiTokenResponseSchema,
  updateApiTokenSchema,
  bookParamsSchema,
  createBookSchema,
  updateBookSchema,
  type BookResponse,
} from '@package/contract';
import {bookService} from '../book/book.service';
import {unitService} from '../unit/unit.service';
import {BasicAdminPermission} from '@package/contract';

/**
 * Token API - routes under /token
 *
 * Responsibilities:
 * - Token management for authenticated users (CRUD for ApiToken)
 * - A small set of token-authenticated book operations
 */
export const tokenApi = coreInstance('/token')
  /**
   * List tokens for current user
   * GET /token/tokens
   */
  .get(
    '/tokens',
    async ({headers, jwt, set}) => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      if (!BasicAdminPermission(payload as any)) {
        set.status = 403;
        throw new Error('Forbidden: Cannot list tokens');
      }
      const tokens = await tokenService.listTokens(payload.unitId);
      return {tokens};
    },
    {
      detail: {
        summary: 'List API tokens',
        description: 'List non-revoked API tokens for the current user',
        tags: ['Token', 'Token Management'],
      },
      response: apiTokenListResponseSchema,
    },
  )

  /**
   * Create a new token for current user
   * POST /token/tokens
   */
  .post(
    '/tokens',
    async ({headers, jwt, set, body, request}) => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      if (!BasicAdminPermission(payload as any)) {
        set.status = 403;
        throw new Error('Forbidden: Cannot create token');
      }

      const ip =
        request.headers.get('x-forwarded-for') ??
        request.headers.get('x-real-ip') ??
        null;
      const userAgent = request.headers.get('user-agent') ?? null;

      const {token, tokenInfo} = await tokenService.createToken(
        payload.unitId,
        body,
        {ip, userAgent},
      );

      return {token, tokenInfo};
    },
    {
      body: createApiTokenSchema,
      response: createApiTokenResponseSchema,
      detail: {
        summary: 'Create API token',
        description:
          'Create a new API token for the current user. The raw token is returned once.',
        tags: ['Token', 'Token Management'],
      },
    },
  )

  /**
   * Update token metadata
   * PUT /token/tokens/:id
   */
  .put(
    '/tokens/:id',
    async ({headers, jwt, set, params, body}) => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      if (!BasicAdminPermission(payload as any)) {
        set.status = 403;
        throw new Error('Forbidden: Cannot update token');
      }
      const updated = await tokenService.updateToken(
        payload.unitId,
        params.id,
        body,
      );
      return updated;
    },
    {
      params: t.Object({id: t.String()}),
      body: updateApiTokenSchema,
      response: apiTokenDTOSchema,
      detail: {
        summary: 'Update API token',
        description:
          'Update name, scopes, or expiration time of an existing API token',
        tags: ['Token', 'Token Management'],
      },
    },
  )

  /**
   * Revoke a token
   * DELETE /token/tokens/:id
   */
  .delete(
    '/tokens/:id',
    async ({headers, jwt, set, params}) => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      if (!BasicAdminPermission(payload as any)) {
        set.status = 403;
        throw new Error('Forbidden: Cannot revoke token');
      }
      await tokenService.revokeToken(payload.unitId, params.id);
      return {message: 'Token revoked successfully'};
    },
    {
      params: t.Object({id: t.String()}),
      detail: {
        summary: 'Revoke API token',
        description: 'Soft-revoke an API token so it can no longer be used',
        tags: ['Token', 'Token Management'],
      },
    },
  )

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

      const {userId, scopes} = await tokenService.authenticateFromHeader(
        headers.authorization,
        {status: set.status as number | undefined},
        {ip, userAgent},
      );

      if (!tokenService.hasScope(scopes, 'book', 'read')) {
        set.status = 403;
        throw new Error('Forbidden: token does not have book:read scope');
      }

      const book = await bookService.getByUnitId(params.unitId);

      // Only allow access to books owned by this token's user
      if (book.unit.userId !== userId) {
        set.status = 403;
        throw new Error('Forbidden: token does not own this book');
      }

      // Reuse existing DTO mapper through the book service index
      const {mapBookToDTO} = await import('../book/mapper');
      return mapBookToDTO(book as any);
    },
    {
      params: bookParamsSchema,
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

      if (!tokenService.hasScope(scopes, 'book', 'write')) {
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
    async ({headers, set, params, body, request}): Promise<BookResponse> => {
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

      if (!tokenService.hasScope(scopes, 'book', 'write')) {
        set.status = 403;
        throw new Error('Forbidden: token does not have book:write scope');
      }

      const unit = await unitService.getByUnitId(params.unitId);
      if (!unit || unit.userId !== userId) {
        set.status = 403;
        throw new Error('Forbidden: token does not own this book');
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

      if (!tokenService.hasScope(scopes, 'book', 'delete')) {
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
  );
