import { t } from "elysia";
import {
  CONTENT_DOC_SCHEMA,
  markdownContentBlockSchema,
  unitRefSourceSchema,
} from "./content-doc-v1";

export const CONTENT_DOC_V2_VERSION = 2 as const;

export type SlotId = string;

export const slotRenderCardSizeSchema = t.Union([
  t.Literal("compact"),
  t.Literal("regular"),
  t.Literal("rich"),
]);

export const unitRefSlotSchema = t.Object({
  type: t.Literal("unit-ref"),
  ref: unitRefSourceSchema,
  render: t.Optional(
    t.Object({
      view: t.Optional(
        t.Union([
          t.Literal("card"),
          t.Literal("chip"),
          t.Literal("hover-preview"),
        ]),
      ),
      cardSize: t.Optional(slotRenderCardSizeSchema),
    }),
  ),
});

export const entityListSlotSchema = t.Object({
  type: t.Literal("entity-list"),
  refs: t.Array(unitRefSourceSchema),
  title: t.Optional(markdownContentBlockSchema),
  render: t.Optional(
    t.Object({
      layout: t.Optional(
        t.Union([
          t.Literal("horizontal"),
          t.Literal("vertical"),
          t.Literal("grid"),
          t.Literal("table"),
        ]),
      ),
      cardSize: t.Optional(slotRenderCardSizeSchema),
      groupBy: t.Optional(t.Union([t.Literal("unitType"), t.Literal("none")])),
    }),
  ),
});

export const infoboxDateValueSchema = t.Object({
  type: t.Literal("date"),
  iso: t.String(),
});

export const infoboxLinkValueSchema = t.Object({
  type: t.Literal("link"),
  url: t.String(),
  label: t.Optional(t.String()),
});

export const infoboxValueSchema = t.Union([
  markdownContentBlockSchema,
  unitRefSourceSchema,
  t.Array(unitRefSourceSchema),
  infoboxDateValueSchema,
  infoboxLinkValueSchema,
]);

export const infoboxSlotSchema = t.Object({
  type: t.Literal("infobox"),
  rows: t.Array(
    t.Object({
      label: markdownContentBlockSchema,
      value: infoboxValueSchema,
    }),
  ),
});

export const unknownSlotSchema = t.Intersect([
  t.Object({
    type: t.String(),
  }),
  t.Record(t.String(), t.Any()),
]);

export const slotSchema = t.Union([
  unitRefSlotSchema,
  entityListSlotSchema,
  infoboxSlotSchema,
  unknownSlotSchema,
]);

export type UnitRefSlot = (typeof unitRefSlotSchema)["static"];
export type EntityListSlot = (typeof entityListSlotSchema)["static"];
export type InfoboxSlot = (typeof infoboxSlotSchema)["static"];
export type UnknownSlot = (typeof unknownSlotSchema)["static"];
export type Slot = UnitRefSlot | EntityListSlot | InfoboxSlot | UnknownSlot;

export const contentDocLayoutRegionSchema = t.Union([
  t.Literal("main"),
  t.Literal("aside"),
  t.Literal("after-main"),
  t.Literal("before-main"),
]);

export const contentDocLayoutEntrySchema = t.Object({
  region: contentDocLayoutRegionSchema,
  slotId: t.String(),
});

// V2 is a draft schema for researched dynamic layout and slot behavior. Runtime
// write/read paths still enable v1 only.
export const contentDocV2Schema = t.Object({
  schema: t.Literal(CONTENT_DOC_SCHEMA),
  version: t.Literal(CONTENT_DOC_V2_VERSION),
  main: markdownContentBlockSchema,
  slots: t.Optional(t.Record(t.String(), slotSchema)),
  layout: t.Optional(t.Array(contentDocLayoutEntrySchema)),
});

export type ContentDocV2 = (typeof contentDocV2Schema)["static"];
export type ContentDocLayoutEntry =
  (typeof contentDocLayoutEntrySchema)["static"];
