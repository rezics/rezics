import {Elysia} from 'elysia';
import {coreInstance} from '../core';
import {serverCorsPolicy} from '@/src/middleware';
import {unitService} from '@/src/unit/unit.service';
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
import {
  buildActorFromContext,
  identityContextPlugin,
  sessionContextPlugin,
} from '@/src/middleware';

export const readlistApi = coreInstance('/readlists').use(serverCorsPolicy('credentialed'))
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
  .use(
    new Elysia().use(sessionContextPlugin).get(
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
        query: readlistListQuerySchema,
        detail: {
          summary: 'Get all readlists',
          description: 'List readlists with rich filters and pagination',
          tags: ['Readlists'],
        },
      },
    ),
  )
  .use(
    new Elysia().use(identityContextPlugin).post(
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
        body: createReadlistSchema,
        detail: {
          summary: 'Create readlist',
          description: 'Create a new readlist',
          tags: ['Readlists'],
        },
      },
    ),
  )
  .use(
    new Elysia()
      .use(sessionContextPlugin)
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
          params: readlistParamsSchema,
          detail: {
            summary: 'Delete readlist',
            description: 'Delete a readlist by unit ID',
            tags: ['Readlists'],
          },
        },
      ),
  );

export default readlistApi;
