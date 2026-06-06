import { t } from "elysia";

// ============================================================
// DRAFT METADATA (cross-type unified listing)
// ============================================================
//
// Each content type (review, post, remark, wiki, shelf description)
// already persists its own draft. `DraftMetadata` is the unified,
// read-only projection the dashboard and the `u/me/drafts` page consume
// to list and recover drafts across all types without duplicating each
// type's storage model.

export const draftKindSchema = t.Union([
  t.Literal("review"),
  t.Literal("post"),
  t.Literal("remark"),
  t.Literal("wiki"),
  t.Literal("shelf-description"),
]);

export type DraftKind = (typeof draftKindSchema)["static"];

export const draftMetadataSchema = t.Object({
  /** Stable per-type draft identifier (used for recover/discard). */
  id: t.String(),
  kind: draftKindSchema,
  /** Display title; falls back to a type-appropriate placeholder. */
  title: t.String(),
  /** Short plain-text excerpt of the draft body, <= 200 chars. */
  excerpt: t.Optional(t.String()),
  /** ISO timestamp of the last edit, used for ordering. */
  updatedAt: t.String(),
  /**
   * The Unit the draft targets, when the draft is attached to existing
   * content (e.g. a review of a book, a remark on a chapter).
   */
  targetUnitId: t.Optional(t.Nullable(t.String())),
  /** Resume route the client navigates to in order to continue editing. */
  resumeRoute: t.String(),
});

export type DraftMetadata = (typeof draftMetadataSchema)["static"];

export const draftListResponseSchema = t.Object({
  drafts: t.Array(draftMetadataSchema),
});

export type DraftListResponse = (typeof draftListResponseSchema)["static"];

export const draftListQuerySchema = t.Object({
  kind: t.Optional(draftKindSchema),
  limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 })),
});

export type DraftListQuery = (typeof draftListQuerySchema)["static"];
