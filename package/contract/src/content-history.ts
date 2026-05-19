import { t } from "elysia";
import { lockFieldKeySchema } from "./content-authority";

export const HistoryOutboxPayloadKind = {
  EDITORIAL_REVISION: "editorial_revision",
  STRUCTURE_EVENT: "structure_event",
  LOCK_MUTATION: "lock_mutation",
  COLLABORATOR_MUTATION: "collaborator_mutation",
} as const;

export type HistoryOutboxPayloadKind =
  (typeof HistoryOutboxPayloadKind)[keyof typeof HistoryOutboxPayloadKind];

export const historyOutboxPayloadKindSchema = t.Union([
  t.Literal(HistoryOutboxPayloadKind.EDITORIAL_REVISION),
  t.Literal(HistoryOutboxPayloadKind.STRUCTURE_EVENT),
  t.Literal(HistoryOutboxPayloadKind.LOCK_MUTATION),
  t.Literal(HistoryOutboxPayloadKind.COLLABORATOR_MUTATION),
]);

export const revisionSlotNameSchema = t.Union([
  t.Literal("unit"),
  t.Literal("translations"),
  t.Literal("supportLanguages"),
  t.Literal("extension"),
  t.Literal("credits"),
  t.Literal("subjects"),
  t.Literal("tags"),
  t.Literal("post"),
]);

export const revisionContentSchema = t.Object({
  hash: t.String(),
  payload: t.Record(t.String(), t.Any()),
  createdAt: t.Union([t.String(), t.Date()]),
});

export type RevisionContentDTO = (typeof revisionContentSchema)["static"];

export const editorialRevisionPayloadSchema = t.Object({
  unitId: t.String(),
  sequence: t.Number(),
  actorUserId: t.String(),
  changedFieldKeys: t.Array(lockFieldKeySchema),
  slots: t.Partial(
    t.Record(
      revisionSlotNameSchema,
      t.Union([t.Array(t.Any()), t.Record(t.String(), t.Any())]),
    ),
  ),
  message: t.Optional(t.Nullable(t.String())),
});

export type EditorialRevisionPayload =
  (typeof editorialRevisionPayloadSchema)["static"];

export const structureEventPayloadSchema = t.Object({
  unitId: t.String(),
  sequence: t.Number(),
  actorUserId: t.String(),
  eventType: t.String(),
  changedFieldKeys: t.Array(lockFieldKeySchema),
  payload: t.Record(t.String(), t.Any()),
  message: t.Optional(t.Nullable(t.String())),
});

export type StructureEventPayload =
  (typeof structureEventPayloadSchema)["static"];

export const historyOutboxPayloadSchema = t.Union([
  t.Object({
    kind: t.Literal(HistoryOutboxPayloadKind.EDITORIAL_REVISION),
    revision: editorialRevisionPayloadSchema,
  }),
  t.Object({
    kind: t.Literal(HistoryOutboxPayloadKind.STRUCTURE_EVENT),
    event: structureEventPayloadSchema,
  }),
  t.Object({
    kind: t.Literal(HistoryOutboxPayloadKind.LOCK_MUTATION),
    revision: editorialRevisionPayloadSchema,
  }),
  t.Object({
    kind: t.Literal(HistoryOutboxPayloadKind.COLLABORATOR_MUTATION),
    revision: editorialRevisionPayloadSchema,
  }),
]);

export type HistoryOutboxPayload =
  (typeof historyOutboxPayloadSchema)["static"];

export const unitRevisionSchema = t.Object({
  id: t.String(),
  unitId: t.String(),
  sequence: t.Number(),
  contentHash: t.String(),
  actorUserId: t.String(),
  changedFieldKeys: t.Array(lockFieldKeySchema),
  message: t.Optional(t.Nullable(t.String())),
  createdAt: t.Union([t.String(), t.Date()]),
  ingestedAt: t.Optional(t.Union([t.String(), t.Date()])),
  content: t.Optional(revisionContentSchema),
});

export type UnitRevisionDTO = (typeof unitRevisionSchema)["static"];

export const unitRevisionTimelinePageSchema = t.Object({
  revisions: t.Array(unitRevisionSchema),
  nextCursor: t.Optional(t.Nullable(t.String())),
});

export type UnitRevisionTimelinePage =
  (typeof unitRevisionTimelinePageSchema)["static"];

export const singleUnitRevisionResponseSchema = t.Object({
  revision: unitRevisionSchema,
});

export type SingleUnitRevisionResponse =
  (typeof singleUnitRevisionResponseSchema)["static"];

export const structureEventSchema = t.Object({
  id: t.String(),
  unitId: t.String(),
  sequence: t.Number(),
  eventType: t.String(),
  actorUserId: t.String(),
  changedFieldKeys: t.Array(lockFieldKeySchema),
  payload: t.Record(t.String(), t.Any()),
  message: t.Optional(t.Nullable(t.String())),
  createdAt: t.Union([t.String(), t.Date()]),
  ingestedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type StructureEventDTO = (typeof structureEventSchema)["static"];

export const structureEventTimelinePageSchema = t.Object({
  events: t.Array(structureEventSchema),
  nextCursor: t.Optional(t.Nullable(t.String())),
});

export type StructureEventTimelinePage =
  (typeof structureEventTimelinePageSchema)["static"];

export const singleStructureEventResponseSchema = t.Object({
  event: structureEventSchema,
});

export type SingleStructureEventResponse =
  (typeof singleStructureEventResponseSchema)["static"];
