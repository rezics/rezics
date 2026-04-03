import {t, Elysia} from 'elysia';
import {authMacro} from '@/middleware';
import {tokenService} from './token.service';
import {
  apiTokenDTOSchema,
  apiTokenListResponseSchema,
  createApiTokenSchema,
  createApiTokenResponseSchema,
  updateApiTokenSchema,
  BasicAdminPermission,
} from '@rezics/contract';
import {bookRoute} from './token.book.api';
import {userRoute} from './token.user.api';

// Token-auth book & user routes (independent auth via API token header)
const tokenExternalRoutes = new Elysia({prefix: '/token'})
  .use(bookRoute)
  .use(userRoute);

// Owner-authenticated token management routes
const tokenManagementRoutes = new Elysia({prefix: '/token'})
  .use(authMacro)
  .get(
    '/tokens',
    async ({identity, currentUser, set}) => {
      if (!identity || !currentUser) {
        set.status = 401;
        throw new Error('Unauthorized');
      }
      if (!BasicAdminPermission(currentUser)) {
        set.status = 403;
        throw new Error('Forbidden: Cannot list tokens');
      }
      const tokens = await tokenService.listTokens(identity.unitId);
      return {tokens};
    },
    {
      requireOwner: true,
      detail: {
        summary: 'List API tokens',
        description: 'List non-revoked API tokens for the current user',
        tags: ['Token', 'Token Management'],
      },
      response: apiTokenListResponseSchema,
    },
  )
  .post(
    '/tokens',
    async ({identity, currentUser, set, body, request}) => {
      if (!identity || !currentUser) {
        set.status = 401;
        throw new Error('Unauthorized');
      }
      if (!BasicAdminPermission(currentUser)) {
        set.status = 403;
        throw new Error('Forbidden: Cannot create token');
      }

      const ip =
        request.headers.get('x-forwarded-for') ??
        request.headers.get('x-real-ip') ??
        null;
      const userAgent = request.headers.get('user-agent') ?? null;

      const {token, tokenInfo} = await tokenService.createToken(
        identity.unitId,
        body,
        {ip, userAgent},
      );

      return {token, tokenInfo};
    },
    {
      requireOwner: true,
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
  .put(
    '/tokens/:id',
    async ({identity, currentUser, set, params, body}) => {
      if (!identity || !currentUser) {
        set.status = 401;
        throw new Error('Unauthorized');
      }
      if (!BasicAdminPermission(currentUser)) {
        set.status = 403;
        throw new Error('Forbidden: Cannot update token');
      }
      return tokenService.updateToken(identity.unitId, params.id, body);
    },
    {
      requireOwner: true,
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
  .delete(
    '/tokens/:id',
    async ({identity, currentUser, set, params}) => {
      if (!identity || !currentUser) {
        set.status = 401;
        throw new Error('Unauthorized');
      }
      if (!BasicAdminPermission(currentUser)) {
        set.status = 403;
        throw new Error('Forbidden: Cannot revoke token');
      }
      await tokenService.revokeToken(identity.unitId, params.id);
      return {message: 'Token revoked successfully'};
    },
    {
      requireOwner: true,
      params: t.Object({id: t.String()}),
      detail: {
        summary: 'Revoke API token',
        description: 'Soft-revoke an API token so it can no longer be used',
        tags: ['Token', 'Token Management'],
      },
    },
  );

export const tokenApi = new Elysia()
  .use(tokenExternalRoutes)
  .use(tokenManagementRoutes);
