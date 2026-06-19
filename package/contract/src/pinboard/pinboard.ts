import type { Static } from "elysia";
import { t } from "elysia";

export const pinboardKindSchema = t.Literal("list");

export type PinboardKind = "list";

export const realmPinboardPlacementSchema = t.Literal("home");

export type RealmPinboardPlacement = "home";

export const pinboardEntryDTOSchema = t.Object(
  {
    unitId: t.String(),
    position: t.String(),
    createdAt: t.Optional(t.Union([t.String(), t.Date()])),
    updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
  },
  { additionalProperties: false },
);

export type PinboardEntryDTO = Static<typeof pinboardEntryDTOSchema>;

export const pinboardDTOSchema = t.Object(
  {
    id: t.String(),
    realmUnitId: t.String(),
    placement: realmPinboardPlacementSchema,
    kind: pinboardKindSchema,
    entries: t.Array(pinboardEntryDTOSchema),
    createdAt: t.Optional(t.Union([t.String(), t.Date()])),
    updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
  },
  { additionalProperties: false },
);

export type PinboardDTO = Static<typeof pinboardDTOSchema>;

export const pinboardPathParamsSchema = t.Object({
  realmId: t.String(),
  placement: realmPinboardPlacementSchema,
});

export type PinboardPathParams = Static<typeof pinboardPathParamsSchema>;

export const pinboardEntryPathParamsSchema = t.Object({
  realmId: t.String(),
  placement: realmPinboardPlacementSchema,
  unitId: t.String(),
});

export type PinboardEntryPathParams = Static<
  typeof pinboardEntryPathParamsSchema
>;

export const pinboardAppendBodySchema = t.Object({
  unitId: t.String(),
});

export type PinboardAppendBody = Static<typeof pinboardAppendBodySchema>;

export const pinboardReorderBodySchema = t.Object({
  unitIds: t.Array(t.String()),
});

export type PinboardReorderBody = Static<typeof pinboardReorderBodySchema>;

export const pinboardReadResponseSchema = t.Object({
  realmId: t.String(),
  placement: realmPinboardPlacementSchema,
  kind: pinboardKindSchema,
  unitIds: t.Array(t.String()),
});

export type PinboardReadResponse = Static<typeof pinboardReadResponseSchema>;

export const pinboardAdminReadResponseSchema = t.Object({
  realmId: t.String(),
  placement: realmPinboardPlacementSchema,
  kind: pinboardKindSchema,
  unitIds: t.Array(t.String()),
  staleIds: t.Array(t.String()),
});

export type PinboardAdminReadResponse = Static<
  typeof pinboardAdminReadResponseSchema
>;

export const pinboardOkResponseSchema = t.Object({
  ok: t.Literal(true),
  unitIds: t.Optional(t.Array(t.String())),
});

export type PinboardOkResponse = Static<typeof pinboardOkResponseSchema>;
