import type { Static } from "elysia";
import { t } from "elysia";

/**
 * `id` is reserved for real resource identity: database rows, Units, auth
 * subjects, DTO identity, or third-party protocol identity. Persisted schema
 * nodes use `nodeId` only when the product needs a reorder-safe in-envelope
 * target for editing, patching, analytics, debugging, or references.
 */
export const schemaNodeIdSchema = t.String({
  minLength: 36,
  maxLength: 36,
});

export type SchemaNodeId = Static<typeof schemaNodeIdSchema>;

/**
 * `slug` is a human-readable locator for URLs, anchors, menu addresses, and
 * author-facing selectors. It is not an editor key and must not preserve node
 * identity across rename or reorder.
 */
export const schemaSlugSchema = t.String({ minLength: 1 });

export type SchemaSlug = Static<typeof schemaSlugSchema>;

/**
 * `schema` and `version` live only at envelope roots. Child components carry
 * the persisted `kind` discriminant; host-specific slots use `placement`.
 */
export const schemaEnvelopeNameSchema = t.String({ minLength: 1 });
export const schemaEnvelopeVersionSchema = t.Integer({ minimum: 1 });
export const schemaComponentKindSchema = t.String({ minLength: 1 });
export const schemaPlacementSchema = t.String({ minLength: 1 });
