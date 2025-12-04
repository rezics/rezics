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

import {bookRoute} from './token.book.api';

/**
 * Token API - routes under /token
 *
 * Responsibilities:
 * - Token management for authenticated users (CRUD for ApiToken)
 * - A small set of token-authenticated book operations
 */
export const tokenApi = coreInstance('/token')
  .use(bookRoute)
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
  );
