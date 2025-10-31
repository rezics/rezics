import {Elysia, t} from 'elysia';
import {coreInstance} from '../core';
import {
  unitListQuerySchema,
  unitParamsSchema,
  unitResponseSchema,
  unitListResponseSchema,
  createUnitSchema,
  updateUnitSchema,
  commentTreeQuerySchema,
  commentTreeResponseSchema,
  type UnitListQuery,
  type UnitListResponse,
  type UnitResponse,
  type CreateUnitInput,
  type UpdateUnitInput,
  type CommentTreeResponse,
} from '@package/contract';
import {unitService} from './unit.service';
import {mapUnitToDTO} from './mapper';
import {verifyAuth} from '@/src/utils/authUtils';

/**
 * Unit Controller - Elysia.js routes
 * Provide generic Unit listing, CRUD, and Comment Tree retrieval.
 */
export const unitApi = coreInstance('/units')
  /**
   * List Units with rich filters and pagination
   * GET /units
   */
  .get(
    '/',
    async ({query}): Promise<UnitListResponse> => {
      const {units, total} = await unitService.list(query as UnitListQuery);
      return {units: units.map(mapUnitToDTO), total};
    },
    {
      query: unitListQuerySchema,
      response: unitListResponseSchema,
      detail: {
        summary: 'List units',
        description:
          'List Units with search, filtering by type/status/tags/user/domains, and pagination with cursor or offset.',
        tags: ['Units'],
      },
    },
  )

  /**
   * Get a single Unit by id
   * GET /units/:unitId
   */
  .get(
    '/:unitId',
    async ({params}): Promise<UnitResponse> => {
      const unit = await unitService.getByUnitId(params.unitId);
      return mapUnitToDTO(unit);
    },
    {
      params: unitParamsSchema,
      response: unitResponseSchema,
      detail: {
        summary: 'Get unit',
        description: 'Get a single Unit (with relations) by its id',
        tags: ['Units'],
      },
    },
  )

  /**
   * Create a Unit
   * POST /units
   */
  .post(
    '/',
    async ({body, headers, jwt, set}): Promise<UnitResponse> => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      // Enforce creating for current user
      const createReq: CreateUnitInput = {
        ...body,
        userId: payload.userId,
      };
      const unit = await unitService.create(createReq);
      return mapUnitToDTO(unit);
    },
    {
      body: createUnitSchema,
      response: unitResponseSchema,
      detail: {
        summary: 'Create unit',
        description: 'Create a new Unit. Type must be one of UnitType.',
        tags: ['Units'],
      },
    },
  )

  /**
   * Update a Unit (ownership required)
   * PUT /units/:unitId
   */
  .put(
    '/:unitId',
    async ({params, body, headers, jwt, set}): Promise<UnitResponse> => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const target = await unitService.getByUnitId(params.unitId);
      if (!target) {
        set.status = 404;
        throw new Error(`Unit not found: ${params.unitId}`);
      }
      if (target.userId !== payload.userId) {
        set.status = 403;
        throw new Error('Forbidden: you do not own this unit');
      }
      const unit = await unitService.update(
        params.unitId,
        body as UpdateUnitInput,
      );
      return mapUnitToDTO(unit);
    },
    {
      params: unitParamsSchema,
      body: updateUnitSchema,
      response: unitResponseSchema,
      detail: {
        summary: 'Update unit',
        description: 'Update mutable fields of a Unit by id',
        tags: ['Units'],
      },
    },
  )

  /**
   * Delete a Unit (ownership required)
   * DELETE /units/:unitId
   */
  .delete(
    '/:unitId',
    async ({params, headers, jwt, set}): Promise<{message: string}> => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const target = await unitService.getByUnitId(params.unitId);
      if (!target) {
        set.status = 404;
        throw new Error(`Unit not found: ${params.unitId}`);
      }
      if (target.userId !== payload.userId) {
        set.status = 403;
        throw new Error('Forbidden: you do not own this unit');
      }
      await unitService.delete(params.unitId);
      return {message: 'Unit deleted successfully'};
    },
    {
      params: unitParamsSchema,
      detail: {
        summary: 'Delete unit',
        description: 'Delete a Unit by id (cascades to related indexes)',
        tags: ['Units'],
      },
    },
  )

  /**
   * Comment Tree (flat slice) under a root Unit
   * GET /units/:unitId/comment-tree
   * Query parameters:
   * - parentId: if provided, returns only direct children of this comment
   * - maxDepth: when parentId is omitted, returns comments up to this depth from the root (0-based)
   * - start/limit: pagination controls
   * - order: asc|desc by createdAt
   */
  .get(
    '/:unitId/comment-tree',
    async ({params, query}): Promise<CommentTreeResponse> => {
      const items = await unitService.getCommentTreeFlat(params.unitId, {
        parentId: (query as any).parentId,
        maxDepth: (query as any).maxDepth,
        start: (query as any).start,
        limit: (query as any).limit,
        order: ((query as any).order as 'asc' | 'desc') ?? 'asc',
      });
      return {rootUnitId: params.unitId, items};
    },
    {
      params: unitParamsSchema,
      query: commentTreeQuerySchema,
      response: commentTreeResponseSchema,
      detail: {
        summary: 'Get comment tree slice',
        description:
          'Returns a flat slice of comments under the root unit using CommentIndex to optimize tree retrieval.',
        tags: ['Units', 'Comments'],
      },
    },
  );

export type UnitApi = typeof unitApi;
