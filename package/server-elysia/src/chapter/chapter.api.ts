import {t} from 'elysia';
import {coreInstance} from '../core';
import {verifyAuth} from '@/src/utils/authUtils';
import {
  chapterListQuerySchema,
  chapterParamsSchema,
  createChapterSchema,
  updateChapterSchema,
  type ChapterListResponse,
  type ChapterResponse,
  type CreateChapterInput,
  type UpdateChapterInput,
} from '@package/contract';
import {chapterService} from './chapter.service.ts';
import {
  mapUnitToChapterDetailDTO,
  mapUnitToChapterListItemDTO,
} from './mapper.ts';
import {unitService} from '@/src/unit/unit.service';

export const chapterApi = coreInstance('/chapters')
  // List chapters
  .get(
    '/',
    async ({query}): Promise<ChapterListResponse> => {
      const {items, total} = await chapterService.list(query);
      return {
        items: items.map(mapUnitToChapterListItemDTO),
        total,
      };
    },
    {
      query: chapterListQuerySchema,
      detail: {
        summary: 'List chapters',
        description:
          'List chapter units with advanced filters (search, tags, status, targetUnitId, user, time range) and pagination',
        tags: ['Chapters'],
      },
    },
  )

  // Get chapter by unitId
  .get(
    '/:unitId',
    async ({params}): Promise<ChapterResponse> => {
      const unit = await chapterService.getByUnitId(params.unitId);
      return mapUnitToChapterDetailDTO(unit);
    },
    {
      params: chapterParamsSchema,
      detail: {
        summary: 'Get chapter',
        description: 'Get a single chapter unit by unit ID',
        tags: ['Chapters'],
      },
    },
  )

  // Create a chapter
  .post(
    '/',
    async ({body, headers, jwt, set}): Promise<ChapterResponse> => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const req: CreateChapterInput = {
        userId: payload.userId,
        title: body.title,
        content: body.content,
        targetUnitId: body.targetUnitId,
        metadata: body.metadata,
        status: body.status,
      };
      const unit = await chapterService.create(req);
      return mapUnitToChapterDetailDTO(unit);
    },
    {
      body: createChapterSchema,
      detail: {
        summary: 'Create chapter',
        description: 'Create a new chapter unit (CHAPTER)',
        tags: ['Chapters'],
      },
    },
  )

  // Update a chapter
  .put(
    '/:unitId',
    async ({params, body, headers, jwt, set}): Promise<ChapterResponse> => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const target = await unitService.getByUnitId(params.unitId);
      if (!target) {
        set.status = 404;
        throw new Error(`Chapter not found: ${params.unitId}`);
      }
      if (target.userId !== payload.userId) {
        set.status = 403;
        throw new Error('Forbidden: you do not have permission to update');
      }
      const unit = await chapterService.update(params.unitId, body);
      return mapUnitToChapterDetailDTO(unit);
    },
    {
      params: chapterParamsSchema,
      body: updateChapterSchema,
      detail: {
        summary: 'Update chapter',
        description: 'Update an existing chapter (by unit ID)',
        tags: ['Chapters'],
      },
    },
  )

  // Delete a chapter
  .delete(
    '/:unitId',
    async ({params, headers, jwt, set}): Promise<{message: string}> => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const target = await unitService.getByUnitId(params.unitId);
      if (!target) {
        set.status = 404;
        throw new Error(`Chapter not found: ${params.unitId}`);
      }
      if (target.userId !== payload.userId) {
        set.status = 403;
        throw new Error('Forbidden: you do not have permission to delete');
      }
      await chapterService.delete(params.unitId);
      return {message: 'Chapter deleted successfully'};
    },
    {
      params: chapterParamsSchema,
      detail: {
        summary: 'Delete chapter',
        description: 'Delete a chapter unit by unit ID',
        tags: ['Chapters'],
      },
    },
  );
