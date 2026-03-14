import {t} from 'elysia';
import {
  createTagSchema,
  tagListQuerySchema,
  tagParamsSchema,
  updateTagSchema,
  attachTagSchema,
  BasicAdminPermission,
} from '@package/contract';
import type {
  CreateTagInput,
  UpdateTagInput,
  TagDTO,
  TagDetailDTO,
  TagListQuery,
} from '@package/contract';
import {coreInstance} from '../core';
import {tagService} from './tag.service';
import {mapTagDetailToDTO, mapTagToDTO} from './mapper';
import {verifyAuth} from '@/src/user';
import {unitService} from '../unit/unit.service';
import {
  hasPermissionToUpdateTag,
  hasPermissionToDeleteTag,
  hasPermissionToUpdateUnit,
  hasPermissionToDeleteUnit,
} from '@package/contract';

export const tagApi = coreInstance('/tags')
  // List tags (optionally scoped by domain)
  .get(
    '/',
    async ({
      query,
      headers,
      jwt,
      set,
    }): Promise<{tags: TagDTO[]; total: number}> => {
      // const payload = await verifyAuth(headers.authorization, jwt, set);
      // if (!BasicAdminPermission(payload as any)) {
      //   set.status = 403;
      //   throw new Error(
      //     'Forbidden: you do not have permission to get all books',
      //   );
      // }
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

  // Get tag by unitId
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

  // Get tag by name within a domain
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

  // Create tag
  .post(
    '/',
    async ({body, headers, jwt, set}): Promise<TagDetailDTO> => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      if (!payload.unitId) {
        set.status = 403;
        throw new Error(
          'Forbidden: you do not have a unit, please login first',
        );
      }
      const created = await tagService.create(
        payload.unitId,
        body as CreateTagInput,
      );
      return mapTagDetailToDTO(created);
    },
    {
      body: createTagSchema,
      detail: {summary: 'Create tag', tags: ['Tags']},
    },
  )

  // Update tag
  .put(
    '/:unitId',
    async ({params, body, headers, jwt, set}): Promise<TagDetailDTO> => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const existing = await tagService.getByUnitId(params.unitId);

      if (!hasPermissionToUpdateTag(payload as any, existing.unit as any)) {
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
      params: tagParamsSchema,
      body: updateTagSchema,
      detail: {summary: 'Update tag', tags: ['Tags']},
    },
  )

  // Delete tag
  .delete(
    '/:unitId',
    async ({params, headers, jwt, set}): Promise<{message: string}> => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const existing = await tagService.getByUnitId(params.unitId);
      if (!hasPermissionToDeleteTag(payload as any, existing.unit as any)) {
        set.status = 403;
        throw new Error('Forbidden: you do not own this tag');
      }
      await tagService.delete(params.unitId);
      return {message: 'Tag deleted successfully'};
    },
    {
      params: tagParamsSchema,
      detail: {summary: 'Delete tag', tags: ['Tags']},
    },
  )

  // Attach tag to a unit
  .post(
    '/:unitId/attach',
    async ({params, body, headers, jwt, set}): Promise<{message: string}> => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const existing = await tagService.getByUnitId(params.unitId);
      const target = await unitService.getByUnitId(body.targetUnitId);
      if (
        !existing ||
        !target ||
        !hasPermissionToUpdateUnit(payload as any, target as any)
      ) {
        set.status = 403;
        throw new Error('Forbidden: you do not own this tag');
      }
      await tagService.attachToUnit(params.unitId, body.targetUnitId);
      return {message: 'Tag attached successfully'};
    },
    {
      params: tagParamsSchema,
      body: attachTagSchema,
      detail: {summary: 'Attach tag to unit', tags: ['Tags']},
    },
  )

  // Detach tag from a unit
  .post(
    '/:unitId/detach',
    async ({params, body, headers, jwt, set}): Promise<{message: string}> => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const existing = await tagService.getByUnitId(params.unitId);
      if (!hasPermissionToDeleteUnit(payload as any, existing.unit as any)) {
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
      params: tagParamsSchema,
      body: attachTagSchema, // reuse schema
      detail: {summary: 'Detach tag from unit', tags: ['Tags']},
    },
  );
