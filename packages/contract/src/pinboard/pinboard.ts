import type { Static } from "elysia";
import { t } from "elysia";

export const pinboardKindValues = ["list"] as const;

export const pinboardKindSchema = t.Literal("list");

export type PinboardKind = Static<typeof pinboardKindSchema>;

export const pinboardHomeKey = "home" as const;

export const pinboardKeySchema = t.Literal(pinboardHomeKey);

export type PinboardKey = Static<typeof pinboardKeySchema>;

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
    key: pinboardKeySchema,
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
  key: pinboardKeySchema,
});

export type PinboardPathParams = Static<typeof pinboardPathParamsSchema>;

export const pinboardEntryPathParamsSchema = t.Object({
  realmId: t.String(),
  key: pinboardKeySchema,
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
  key: pinboardKeySchema,
  kind: pinboardKindSchema,
  unitIds: t.Array(t.String()),
});

export type PinboardReadResponse = Static<typeof pinboardReadResponseSchema>;

export const pinboardAdminReadResponseSchema = t.Object({
  realmId: t.String(),
  key: pinboardKeySchema,
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
