import { t } from "elysia";
import { type ContentRating, contentRatingSchema } from "../unit";

export const contentStructureNodeSchema: ReturnType<typeof t.Recursive> =
  t.Recursive((self) =>
    t.Object({
      title: t.String(),
      contentUnitId: t.Optional(t.String()),
      noContent: t.Optional(t.Boolean()),
      rating: t.Optional(contentRatingSchema),
      children: t.Optional(t.Array(self)),
      id: t.Optional(t.String()),
      updatedAt: t.Optional(t.String()),
    }),
  );

export type ContentStructurePath = number[];

export interface ContentStructureItem {
  title: string;
  contentUnitId?: string;
  noContent?: boolean;
  rating?: ContentRating;
  children?: ContentStructureItem[];
  id?: string;
  updatedAt?: string;
}

export const contentStructureDTOSchema = t.Object({
  ownerUnitId: t.String(),
  nodes: t.Array(contentStructureNodeSchema),
  createdAt: t.Union([t.String(), t.Date()]),
  updatedAt: t.Union([t.String(), t.Date()]),
});

export type ContentStructureDTO = (typeof contentStructureDTOSchema)["static"];

export interface ContentStructureResponse {
  ownerUnitId: string;
  nodes: ContentStructureItem[];
  createdAt: Date;
  updatedAt: Date;
}
