import {t} from 'elysia';
import {coreInstance} from '../core';
import type {EchoKVResponse, EchoKVUpsertRequest} from './types';
import {echoKvService} from './echokv.service';

export const echoKvApi = coreInstance('/echokv')
  // Get value by key
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

  // Upsert value by key
  .put(
    '/:key',
    async ({params, body}): Promise<EchoKVResponse> => {
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
        // Accept any JSON-compatible value
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
