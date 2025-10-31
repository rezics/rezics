// Tag contracts
export type TagDTO = {
  id: string; // equals Tag.unitId
  name: string;
  type?: string | null;
};

export type TagDetailDTO = TagDTO & {
  i18n?: unknown | null;
  domains?: string[]; // domain user unitIds
};

export type CreateTagInput = {
  name: string;
  type?: string | null;
  i18n?: unknown | null;
  domains?: string[]; // domain user unitIds
};

export type UpdateTagInput = Partial<CreateTagInput>;

import {t} from 'elysia';

export const tagListQuerySchema = t.Object({
  q: t.Optional(t.String()),
  type: t.Optional(t.String()),
  domainId: t.Optional(t.String()),
  // target object unitId within which to search tags (e.g., a book's unitId)
  objectId: t.Optional(t.String()),
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
});
export type TagListQuery = (typeof tagListQuerySchema)['static'];

export const tagParamsSchema = t.Object({
  unitId: t.String(),
});
export type TagParams = (typeof tagParamsSchema)['static'];

export const createTagSchema = t.Object({
  name: t.String({minLength: 1}),
  type: t.Optional(t.Union([t.String(), t.Null()])),
  i18n: t.Optional(t.Any()),
  domains: t.Optional(t.Array(t.String())),
});
export type CreateTag = (typeof createTagSchema)['static'];

export const updateTagSchema = t.Object({
  name: t.Optional(t.String({minLength: 1})),
  type: t.Optional(t.Union([t.String(), t.Null()])),
  i18n: t.Optional(t.Any()),
  domains: t.Optional(t.Array(t.String())),
});
export type UpdateTag = (typeof updateTagSchema)['static'];

export const attachTagSchema = t.Object({
  targetUnitId: t.String(),
});
export type AttachTag = (typeof attachTagSchema)['static'];
