import {Elysia, t} from 'elysia';
import {coreInstance} from '../core';
import {verifyAuth} from '@/src/utils/authUtils';
import {unitService} from '@/src/unit/unit.service';
import {readlistService} from './readlist.service';
import {mapReadlistToDTO, mapBaseReadlistToDTO} from './mapper';
import {
  readlistListQuerySchema,
  readlistParamsSchema,
  createReadlistSchema,
  updateReadlistSchema,
} from '@package/contract';
import type {
  ReadlistListQuery,
  ReadlistListResponse,
  ReadlistResponse,
  CreateReadlistInput,
  UpdateReadlistInput,
} from '@package/contract';

/**
 * Readlist Controller - Elysia.js routes
 * GET /readlists
 */
export const readlistApi = coreInstance('/readlists')
  .get(
    '/',
    async ({query}): Promise<ReadlistListResponse> => {
      const {readlists, total} = await readlistService.list(query as any);
      return {readlists: readlists.map(mapBaseReadlistToDTO), total};
    },
    {
      query: readlistListQuerySchema,
      detail: {
        summary: 'Get all readlists',
        description: 'List readlists with rich filters and pagination',
        tags: ['Readlists'],
      },
    },
  )

  /**
   * Get readlist by unitId
   */
  .get(
    '/:unitId',
    async ({params}): Promise<ReadlistResponse> => {
      const rl = await readlistService.getByUnitId(params.unitId);
      return mapReadlistToDTO(rl);
    },
    {
      params: readlistParamsSchema,
      detail: {
        summary: 'Get readlist',
        description: 'Get a single readlist by unit ID',
        tags: ['Readlists'],
      },
    },
  )

  /**
   * Create readlist
   */
  .post(
    '/',
    async ({body, headers, jwt, set}): Promise<ReadlistResponse> => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const req: CreateReadlistInput = {
        userId: payload.unitId,
        title: body.title,
        coverUrl: body.coverUrl,
        items: body.items,
        bookIds: body.bookIds,
      };
      const rl = await readlistService.create(req);
      return mapReadlistToDTO(rl);
    },
    {
      body: createReadlistSchema,
      detail: {
        summary: 'Create readlist',
        description: 'Create a new readlist',
        tags: ['Readlists'],
      },
    },
  )

  /**
   * Update readlist
   */
  .put(
    '/:unitId',
    async ({params, body, headers, jwt, set}): Promise<ReadlistResponse> => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const target = await unitService.getByUnitId(params.unitId);
      if (!target) {
        set.status = 404;
        throw new Error(`Readlist not found: ${params.unitId}`);
      }
      if (target.userId !== payload.unitId) {
        set.status = 403;
        throw new Error(
          'Forbidden: you do not have permission to update this readlist',
        );
      }
      const rl = await readlistService.update(params.unitId, body);
      return mapReadlistToDTO(rl);
    },
    {
      params: readlistParamsSchema,
      body: updateReadlistSchema,
      detail: {
        summary: 'Update readlist',
        description: 'Update an existing readlist by unit ID',
        tags: ['Readlists'],
      },
    },
  )

  /**
   * Delete readlist
   */
  .delete(
    '/:unitId',
    async ({params, headers, jwt, set}): Promise<{message: string}> => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const target = await unitService.getByUnitId(params.unitId);
      if (!target) {
        set.status = 404;
        throw new Error(`Readlist not found: ${params.unitId}`);
      }
      if (target.userId !== payload.unitId) {
        set.status = 403;
        throw new Error(
          'Forbidden: you do not have permission to delete this readlist',
        );
      }
      await readlistService.delete(params.unitId);
      return {message: 'Readlist deleted successfully'};
    },
    {
      params: readlistParamsSchema,
      detail: {
        summary: 'Delete readlist',
        description: 'Delete a readlist by unit ID',
        tags: ['Readlists'],
      },
    },
  );

export default readlistApi;
