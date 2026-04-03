import {Elysia} from 'elysia';
import {
  serverCorsPolicy,
  authMacro,
  buildActorFromContext,
} from '@/middleware';
import {unitService} from '@/unit/unit.service';
import {readlistService} from './readlist.service';
import {
  readlistListQuerySchema,
  readlistParamsSchema,
  createReadlistSchema,
  updateReadlistSchema,
  hasPermissionToUpdateReadlist,
  hasPermissionToDeleteReadlist,
  BasicAdminPermission,
} from '@package/contract';
import type {
  ReadlistListResponse,
  ReadlistResponse,
  CreateReadlistInput,
} from '@package/contract';

export const readlistApi = new Elysia({prefix: '/readlists'})
  .use(serverCorsPolicy('credentialed'))
  .use(authMacro)
  .get(
    '/:unitId',
    async ({params}): Promise<ReadlistResponse> => {
      return readlistService.getByUnitId(params.unitId);
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
  .post(
    '/',
    async ({body, identity}): Promise<ReadlistResponse> => {
      const req: CreateReadlistInput = {
        title: body.title,
        coverUrl: body.coverUrl,
        book: body.book,
        review: body.review,
        order: body.order,
      };
      return readlistService.create(req, identity.unitId);
    },
    {
      requireLogin: true,
      body: createReadlistSchema,
      detail: {
        summary: 'Create readlist',
        description: 'Create a new readlist',
        tags: ['Readlists'],
      },
    },
  )
  .get(
    '/',
    async ({query, currentUser, set}): Promise<ReadlistListResponse> => {
      if (!BasicAdminPermission(currentUser)) {
        set.status = 403;
        throw new Error(
          'Forbidden: you do not have permission to get all books',
        );
      }
      const {readlists, total} = await readlistService.list(query as any);
      return {readlists, total};
    },
    {
      requireOwner: true,
      query: readlistListQuerySchema,
      detail: {
        summary: 'Get all readlists',
        description: 'List readlists with rich filters and pagination',
        tags: ['Readlists'],
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
    }): Promise<ReadlistResponse> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (!target) {
        set.status = 404;
        throw new Error(`Readlist not found: ${params.unitId}`);
      }
      if (
        !hasPermissionToUpdateReadlist(
          buildActorFromContext({identity, currentUser}),
          target as any,
        )
      ) {
        set.status = 403;
        throw new Error(
          'Forbidden: you do not have permission to update this readlist',
        );
      }
      return readlistService.update(params.unitId, body);
    },
    {
      requireOwner: true,
      params: readlistParamsSchema,
      body: updateReadlistSchema,
      detail: {
        summary: 'Update readlist',
        description: 'Update an existing readlist by unit ID',
        tags: ['Readlists'],
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
        !hasPermissionToDeleteReadlist(
          buildActorFromContext({identity, currentUser}),
          target as any,
        )
      ) {
        set.status = 403;
        throw new Error(
          'Forbidden: you do not have permission to delete this readlist',
        );
      }
      await readlistService.delete(params.unitId);
      return {message: 'Readlist deleted successfully'};
    },
    {
      requireOwner: true,
      params: readlistParamsSchema,
      detail: {
        summary: 'Delete readlist',
        description: 'Delete a readlist by unit ID',
        tags: ['Readlists'],
      },
    },
  );

export default readlistApi;
