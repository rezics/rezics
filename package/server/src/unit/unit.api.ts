import {Elysia} from 'elysia';
import {
  unitListQuerySchema,
  unitParamsSchema,
  unitResponseSchema,
  unitListResponseSchema,
  createUnitSchema,
  updateUnitSchema,
  type UnitListQuery,
  type UnitListResponse,
  type UnitResponse,
  type CreateUnitInput,
  type UpdateUnitInput,
  hasPermissionToUpdateUnit,
  hasPermissionToDeleteUnit,
  BasicAdminPermission,
} from '@package/contract';
import {unitService} from './unit.service';
import {mapUnitToDTO} from './mapper';
import {
  serverCorsPolicy,
  authMacro,
  buildActorFromContext,
} from '@/middleware';

export const unitApi = new Elysia({prefix: '/units'})
  .use(serverCorsPolicy('credentialed'))
  .use(authMacro)
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
  .post(
    '/',
    async ({body, identity}): Promise<UnitResponse> => {
      const createReq: CreateUnitInput = {
        ...body,
        userId: identity.unitId,
      };
      const unit = await unitService.create(createReq);
      return mapUnitToDTO(unit);
    },
    {
      requireLogin: true,
      body: createUnitSchema,
      response: unitResponseSchema,
      detail: {
        summary: 'Create unit',
        description: 'Create a new Unit. Type must be one of UnitType.',
        tags: ['Units'],
      },
    },
  )
  .get(
    '/',
    async ({query, currentUser, set}): Promise<UnitListResponse> => {
      if (!BasicAdminPermission(currentUser)) {
        set.status = 403;
        throw new Error(
          'Forbidden: you do not have permission to get all books',
        );
      }
      const {units, total} = await unitService.list(query as UnitListQuery);
      return {units: units.map(mapUnitToDTO), total};
    },
    {
      requireOwner: true,
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
  .put(
    '/:unitId',
    async ({
      params,
      body,
      identity,
      currentUser,
      set,
    }): Promise<UnitResponse> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToUpdateUnit(
          buildActorFromContext({identity, currentUser}),
          target as any,
        )
      ) {
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
      requireOwner: true,
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
  .delete(
    '/:unitId',
    async ({
      params,
      identity,
      currentUser,
      set,
    }): Promise<{message: string}> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToDeleteUnit(
          buildActorFromContext({identity, currentUser}),
          target as any,
        )
      ) {
        set.status = 403;
        throw new Error('Forbidden: you do not own this unit');
      }
      await unitService.delete(params.unitId);
      return {message: 'Unit deleted successfully'};
    },
    {
      requireOwner: true,
      params: unitParamsSchema,
      detail: {
        summary: 'Delete unit',
        description: 'Delete a Unit by id (cascades to related indexes)',
        tags: ['Units'],
      },
    },
  );

export type UnitApi = typeof unitApi;
