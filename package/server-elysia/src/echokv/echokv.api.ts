import {t} from 'elysia';
import {coreInstance} from '../core';
import type {EchoKVResponse} from './types';
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
  );
