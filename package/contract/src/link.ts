import { t } from "elysia";
import { unitTranslationDTOSchema } from "./unit/unit";

// ============================================================
// LINK DTO
// LINK DTO 链接数据传输对象
// ============================================================

export const linkDTOSchema = t.Object({
  unitId: t.String(),
  url: t.String(),
  siteName: t.Optional(t.Nullable(t.String())),
  faviconUrl: t.Optional(t.Nullable(t.String())),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  translations: t.Optional(t.Array(unitTranslationDTOSchema)),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type LinkDTO = (typeof linkDTOSchema)["static"];

// ============================================================
// CREATE/UPDATE LINK
// CREATE/UPDATE LINK 创建/更新链接
// ============================================================

export const createLinkSchema = t.Object({
  url: t.String(),
  title: t.Optional(t.String()),
  description: t.Optional(t.String()),
  siteName: t.Optional(t.String()),
  faviconUrl: t.Optional(t.String()),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
});

export type CreateLinkInput = (typeof createLinkSchema)["static"];

export const updateLinkSchema = t.Object({
  url: t.Optional(t.String()),
  title: t.Optional(t.String()),
  description: t.Optional(t.String()),
  siteName: t.Optional(t.Nullable(t.String())),
  faviconUrl: t.Optional(t.Nullable(t.String())),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
});

export type UpdateLinkInput = (typeof updateLinkSchema)["static"];
