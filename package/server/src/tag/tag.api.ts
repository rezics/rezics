import {t, Elysia} from 'elysia';
import {
  createTagSchema,
  tagListQuerySchema,
  tagParamsSchema,
  updateTagSchema,
  attachTagSchema,
  hasPermissionToUpdateTag,
  hasPermissionToDeleteTag,
  hasPermissionToUpdateUnit,
  hasPermissionToDeleteUnit,
} from '@rezics/contract';
import type {
  CreateTagInput,
  UpdateTagInput,
  TagDTO,
  TagDetailDTO,
  TagListQuery,
} from '@rezics/contract';
import {
  authMacro,
  buildActorFromContext,
} from '@/middleware';
import {tagService} from './tag.service';
import {mapTagDetailToDTO, mapTagToDTO} from './mapper';
import {unitService} from '../unit/unit.service';

export const tagApi = new Elysia({prefix: '/tags'})
  .use(authMacro)
  .get(
    '/',
    async ({query}): Promise<{tags: TagDTO[]; total: number}> => {
      const {tags, total} = await tagService.list(query as TagListQuery);
      return {tags: tags.map(mapTagToDTO), total};
    },
    {
      query: tagListQuerySchema,
      detail: {
        summary: 'List tags',
        description: 'List tags with filtering and pagination, domain-aware',
        tags: ['Tags'],
      },
    },
  )
  .get(
    '/:unitId',
    async ({params}): Promise<TagDetailDTO> => {
      const tag = await tagService.getByUnitId(params.unitId);
      return mapTagDetailToDTO(tag);
    },
    {
      params: tagParamsSchema,
      detail: {summary: 'Get tag', tags: ['Tags']},
    },
  )
  .get(
    '/by-name',
    async ({query}): Promise<TagDetailDTO | null> => {
      const schema = t.Object({
        name: t.String(),
        type: t.Optional(t.Union([t.String(), t.Null()])),
        domainId: t.String(),
      });
      const q = query as any as typeof schema.static;
      const tag = await tagService.getByNameInDomain(
        q.name,
        q.type ?? null,
        q.domainId,
      );
      return tag ? mapTagDetailToDTO(tag) : null;
    },
    {
      query: t.Object({
        name: t.String(),
        type: t.Optional(t.Union([t.String(), t.Null()])),
        domainId: t.String(),
      }),
      detail: {summary: 'Get tag by name in domain', tags: ['Tags']},
    },
  )
  .post(
    '/',
    async ({body, identity}): Promise<TagDetailDTO> => {
      const created = await tagService.create(
        identity.unitId,
        body as CreateTagInput,
      );
      return mapTagDetailToDTO(created);
    },
    {
      requireLogin: true,
      body: createTagSchema,
      detail: {summary: 'Create tag', tags: ['Tags']},
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
    }): Promise<TagDetailDTO> => {
      const existing = await tagService.getByUnitId(params.unitId);

      if (
        !hasPermissionToUpdateTag(
          buildActorFromContext({identity, currentUser}),
          existing.unit as any,
        )
      ) {
        set.status = 403;
        throw new Error('Forbidden: you do not own this tag');
      }
      const updated = await tagService.update(
        params.unitId,
        body as UpdateTagInput,
      );
      return mapTagDetailToDTO(updated);
    },
    {
      requireOwner: true,
      params: tagParamsSchema,
      body: updateTagSchema,
      detail: {summary: 'Update tag', tags: ['Tags']},
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
      const existing = await tagService.getByUnitId(params.unitId);
      if (
        !hasPermissionToDeleteTag(
          buildActorFromContext({identity, currentUser}),
          existing.unit as any,
        )
      ) {
        set.status = 403;
        throw new Error('Forbidden: you do not own this tag');
      }
      await tagService.delete(params.unitId);
      return {message: 'Tag deleted successfully'};
    },
    {
      requireOwner: true,
      params: tagParamsSchema,
      detail: {summary: 'Delete tag', tags: ['Tags']},
    },
  )
  .post(
    '/:unitId/attach',
    async ({
      params,
      body,
      identity,
      currentUser,
      set,
    }): Promise<{message: string}> => {
      const existing = await tagService.getByUnitId(params.unitId);
      const target = await unitService.getByUnitId(body.targetUnitId);
      if (
        !existing ||
        !target ||
        !hasPermissionToUpdateUnit(
          buildActorFromContext({identity, currentUser}),
          target as any,
        )
      ) {
        set.status = 403;
        throw new Error('Forbidden: you do not own this tag');
      }
      await tagService.attachToUnit(params.unitId, body.targetUnitId);
      return {message: 'Tag attached successfully'};
    },
    {
      requireOwner: true,
      params: tagParamsSchema,
      body: attachTagSchema,
      detail: {summary: 'Attach tag to unit', tags: ['Tags']},
    },
  )
  .post(
    '/:unitId/detach',
    async ({
      params,
      body,
      identity,
      currentUser,
      set,
    }): Promise<{message: string}> => {
      const existing = await tagService.getByUnitId(params.unitId);
      if (
        !hasPermissionToDeleteUnit(
          buildActorFromContext({identity, currentUser}),
          existing.unit as any,
        )
      ) {
        set.status = 403;
        throw new Error('Forbidden: you do not own this tag');
      }
      await tagService.detachFromUnit(
        params.unitId,
        (body as any).targetUnitId,
      );
      return {message: 'Tag detached successfully'};
    },
    {
      requireOwner: true,
      params: tagParamsSchema,
      body: attachTagSchema,
      detail: {summary: 'Detach tag from unit', tags: ['Tags']},
    },
  );
