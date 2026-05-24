import { t } from "elysia";

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

export const editorialPatchSchema = t.Intersect([
  t.Record(t.String(), t.Any()),
  t.Object({
    $unset: t.Optional(t.Array(t.String())),
  }),
]);

export type EditorialPatch = (typeof editorialPatchSchema)["static"];

export const historyRestoreSourceSchema = t.Object({
  kind: t.Literal("revision"),
  unitId: t.String(),
  sequence: t.Number(),
  paths: t.Array(t.String()),
});

export type HistoryRestoreSource =
  (typeof historyRestoreSourceSchema)["static"];

export const editorialPatchSubmissionSchema = t.Object({
  patch: editorialPatchSchema,
  message: t.Optional(t.Nullable(t.String())),
  restoreSource: t.Optional(historyRestoreSourceSchema),
});

export type EditorialPatchSubmission =
  (typeof editorialPatchSubmissionSchema)["static"];

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
  patch: editorialPatchSchema,
  legacyChangedKeys: t.Optional(t.Array(t.String())),
  message: t.Optional(t.Nullable(t.String())),
  restoreSource: t.Optional(historyRestoreSourceSchema),
});

export type EditorialRevisionPayload =
  (typeof editorialRevisionPayloadSchema)["static"];

export const contentStructureNodeSnapshotSchema = t.Object({
  nodeId: t.String(),
  title: t.String(),
  chapterUnitId: t.Optional(t.Nullable(t.String())),
  noContent: t.Optional(t.Boolean()),
  rating: t.Optional(t.Nullable(t.String())),
});

export const contentStructureNodePlacementSchema = t.Object({
  parentId: t.Optional(t.Nullable(t.String())),
  sortKey: t.String(),
});

export const contentStructureNodeCreateOperationSchema = t.Object({
  op: t.Literal("node.create"),
  node: contentStructureNodeSnapshotSchema,
  placement: contentStructureNodePlacementSchema,
});

export const contentStructureNodeUpdateOperationSchema = t.Object({
  op: t.Literal("node.update"),
  nodeId: t.String(),
  before: t.Partial(contentStructureNodeSnapshotSchema),
  after: t.Partial(contentStructureNodeSnapshotSchema),
});

export const contentStructureNodeMoveOperationSchema = t.Object({
  op: t.Literal("node.move"),
  nodeId: t.String(),
  before: contentStructureNodePlacementSchema,
  after: contentStructureNodePlacementSchema,
});

export const contentStructureNodeDeleteOperationSchema = t.Object({
  op: t.Literal("node.delete"),
  node: contentStructureNodeSnapshotSchema,
  placement: contentStructureNodePlacementSchema,
  descendantCount: t.Number(),
});

export const contentStructureNodeLinkOperationSchema = t.Object({
  op: t.Literal("node.link"),
  nodeId: t.String(),
  beforeChapterUnitId: t.Optional(t.Nullable(t.String())),
  afterChapterUnitId: t.String(),
});

export const contentStructureNodeUnlinkOperationSchema = t.Object({
  op: t.Literal("node.unlink"),
  nodeId: t.String(),
  beforeChapterUnitId: t.String(),
});

export const contentStructureBulkReplaceOperationSchema = t.Object({
  op: t.Literal("bulk.replace"),
  beforeNodeCount: t.Number(),
  afterNodeCount: t.Number(),
  reason: t.Optional(t.String()),
});

export const contentStructureBatchOperationSchema = t.Union([
  contentStructureNodeCreateOperationSchema,
  contentStructureNodeUpdateOperationSchema,
  contentStructureNodeMoveOperationSchema,
  contentStructureNodeDeleteOperationSchema,
  contentStructureNodeLinkOperationSchema,
  contentStructureNodeUnlinkOperationSchema,
  contentStructureBulkReplaceOperationSchema,
]);

export type ContentStructureBatchOperation =
  (typeof contentStructureBatchOperationSchema)["static"];

export const bookContentStructureBatchPayloadSchema = t.Object({
  operations: t.Array(contentStructureBatchOperationSchema),
});

export type BookContentStructureBatchPayload =
  (typeof bookContentStructureBatchPayloadSchema)["static"];

export const structureEventPayloadSchema = t.Object({
  unitId: t.String(),
  sequence: t.Number(),
  actorUserId: t.String(),
  eventType: t.String(),
  changedFieldKeys: t.Array(t.String()),
  payload: t.Record(t.String(), t.Any()),
  message: t.Optional(t.Nullable(t.String())),
});

export type StructureEventPayload =
  (typeof structureEventPayloadSchema)["static"];

export const bookContentStructureBatchEventPayloadSchema = t.Object({
  unitId: t.String(),
  sequence: t.Number(),
  actorUserId: t.String(),
  eventType: t.Literal("book.contentStructure.batch"),
  changedFieldKeys: t.Array(t.String()),
  payload: bookContentStructureBatchPayloadSchema,
  message: t.Optional(t.Nullable(t.String())),
});

export type BookContentStructureBatchEventPayload =
  (typeof bookContentStructureBatchEventPayloadSchema)["static"];

export const historyDisplayResolutionStatusSchema = t.Union([
  t.Literal("OK"),
  t.Literal("DELETED"),
  t.Literal("GONE"),
  t.Literal("RESTRICTED"),
]);

export type HistoryDisplayResolutionStatus =
  (typeof historyDisplayResolutionStatusSchema)["static"];

export const historyActorResolutionSchema = t.Object({
  actorUserId: t.String(),
  status: historyDisplayResolutionStatusSchema,
  displayName: t.Optional(t.String()),
  handle: t.Optional(t.String()),
  avatarUrl: t.Optional(t.Nullable(t.String())),
});

export type HistoryActorResolution =
  (typeof historyActorResolutionSchema)["static"];

export const historyActorResolutionBatchResponseSchema = t.Object({
  actors: t.Record(t.String(), historyActorResolutionSchema),
});

export type HistoryActorResolutionBatchResponse =
  (typeof historyActorResolutionBatchResponseSchema)["static"];

export const historyUnitReferenceResolutionSchema = t.Object({
  unitId: t.String(),
  status: historyDisplayResolutionStatusSchema,
  title: t.Optional(t.String()),
  unitType: t.Optional(t.String()),
  slug: t.Optional(t.Nullable(t.String())),
});

export type HistoryUnitReferenceResolution =
  (typeof historyUnitReferenceResolutionSchema)["static"];

export const historyUnitReferenceResolutionBatchResponseSchema = t.Object({
  units: t.Record(t.String(), historyUnitReferenceResolutionSchema),
});

export type HistoryUnitReferenceResolutionBatchResponse =
  (typeof historyUnitReferenceResolutionBatchResponseSchema)["static"];

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

export const unitRevisionTimelineItemSchema = t.Object({
  id: t.String(),
  unitId: t.String(),
  sequence: t.Number(),
  contentHash: t.String(),
  actorUserId: t.String(),
  changedFieldKeys: t.Array(t.String()),
  message: t.Optional(t.Nullable(t.String())),
  createdAt: t.Union([t.String(), t.Date()]),
  ingestedAt: t.Optional(t.Union([t.String(), t.Date()])),
  restoreSource: t.Optional(historyRestoreSourceSchema),
});

export type UnitRevisionTimelineItemDTO =
  (typeof unitRevisionTimelineItemSchema)["static"];

export const unitRevisionSchema = t.Intersect([
  unitRevisionTimelineItemSchema,
  t.Object({
    content: t.Optional(revisionContentSchema),
  }),
]);

export type UnitRevisionDTO = (typeof unitRevisionSchema)["static"];

export const unitRevisionTimelinePageSchema = t.Object({
  revisions: t.Array(unitRevisionTimelineItemSchema),
  nextCursor: t.Optional(t.Nullable(t.String())),
});

export type UnitRevisionTimelinePage =
  (typeof unitRevisionTimelinePageSchema)["static"];

export const singleUnitRevisionResponseSchema = t.Object({
  revision: unitRevisionSchema,
});

export type SingleUnitRevisionResponse =
  (typeof singleUnitRevisionResponseSchema)["static"];

export const unitRevisionPathCompareEntrySchema = t.Object({
  path: t.String(),
  base: t.Object({
    value: t.Nullable(t.Any()),
    sequence: t.Optional(t.Nullable(t.Number())),
  }),
  target: t.Object({
    value: t.Nullable(t.Any()),
    sequence: t.Optional(t.Nullable(t.Number())),
  }),
});

export type UnitRevisionPathCompareEntry =
  (typeof unitRevisionPathCompareEntrySchema)["static"];

export const unitRevisionPathCompareResponseSchema = t.Object({
  unitId: t.String(),
  baseSequence: t.Number(),
  targetSequence: t.Number(),
  candidatePaths: t.Array(t.String()),
  changes: t.Array(unitRevisionPathCompareEntrySchema),
});

export type UnitRevisionPathCompareResponse =
  (typeof unitRevisionPathCompareResponseSchema)["static"];

export const structureEventSchema = t.Object({
  id: t.String(),
  unitId: t.String(),
  sequence: t.Number(),
  eventType: t.String(),
  actorUserId: t.String(),
  changedFieldKeys: t.Array(t.String()),
  payload: t.Optional(t.Record(t.String(), t.Any())),
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
