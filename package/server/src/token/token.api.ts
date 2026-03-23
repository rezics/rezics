import {t, Elysia} from 'elysia';
import {serverCorsPolicy, requireOwner} from '@/src/middleware';
import {tokenService} from './token.service';
import {
  apiTokenDTOSchema,
  apiTokenListResponseSchema,
  createApiTokenSchema,
  createApiTokenResponseSchema,
  updateApiTokenSchema,
  BasicAdminPermission,
} from '@package/contract';
import {bookRoute} from './token.book.api';
import {userRoute} from './token.user.api';

const tokenInstance = new Elysia({prefix: '/token'}).use(
  serverCorsPolicy('credentialed'),
);

export const tokenApi = bookRoute(userRoute(tokenInstance))
  .use(requireOwner)
  .get(
    '/tokens',
    async ({identity, currentUser, set}) => {
      if (!BasicAdminPermission(currentUser)) {
        set.status = 403;
        throw new Error('Forbidden: Cannot list tokens');
      }
      const tokens = await tokenService.listTokens(identity.unitId);
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
  .post(
    '/tokens',
    async ({identity, currentUser, set, body, request}) => {
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
      if (!BasicAdminPermission(currentUser)) {
        set.status = 403;
        throw new Error('Forbidden: Cannot update token');
      }
      return tokenService.updateToken(identity.unitId, params.id, body);
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
  .delete(
    '/tokens/:id',
    async ({identity, currentUser, set, params}) => {
      if (!BasicAdminPermission(currentUser)) {
        set.status = 403;
        throw new Error('Forbidden: Cannot revoke token');
      }
      await tokenService.revokeToken(identity.unitId, params.id);
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
