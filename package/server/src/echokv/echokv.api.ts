import {t, Elysia} from 'elysia';
import {serverCorsPolicy, requireOwner} from '@/middleware';
import type {
  EchoKVKeyListResponse,
  EchoKVResponse,
  EchoKVUpsertRequest,
} from './types';
import {echoKvService} from './echokv.service';
import {BasicAdminPermission} from '@package/contract';

export const echoKvApi = new Elysia({prefix: '/echokv'})
  .use(serverCorsPolicy('credentialed'))
  .get(
    '/',
    async ({query}): Promise<EchoKVKeyListResponse> => {
      const keys = await echoKvService.listKeys(query.search);
      return {keys};
    },
    {
      query: t.Object({
        search: t.Optional(t.String()),
      }),
      detail: {
        summary: 'List keys',
        description: 'List all keys with an optional search string.',
        tags: ['EchoKV'],
      },
    },
  )
  .get(
    '/:key',
    async ({params}): Promise<EchoKVResponse> => {
      const value = await echoKvService.get(params.key);
      return {value};
    },
    {
      params: t.Object({
        key: t.String(),
      }),
      detail: {
        summary: 'Get value by key',
        description: 'Get value by key',
        tags: ['EchoKV'],
      },
    },
  )
  .use(requireOwner)
  .put(
    '/:key',
    async ({params, body, currentUser, set}): Promise<EchoKVResponse> => {
      if (!BasicAdminPermission(currentUser)) {
        set.status = 403;
        throw new Error('Forbidden: You are not authorized to update EchoKV');
      }
      const value = await echoKvService.set(
        params.key,
        body.value as EchoKVUpsertRequest['value'],
      );
      return {value};
    },
    {
      params: t.Object({
        key: t.String(),
      }),
      body: t.Object({
        value: t.Any(),
      }),
      detail: {
        summary: 'Upsert value by key',
        description:
          'Create or update a value by key in the EchoKV store. Existing keys are updated, new keys are created.',
        tags: ['EchoKV'],
      },
    },
  );
