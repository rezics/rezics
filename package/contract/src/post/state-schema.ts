import { t } from "elysia";
import { OFFICIAL_QUESTION_TAG_SLUG } from "./post";
import { OFFICIAL_ISSUE_TAG_SLUG } from "../tag/seed-tags";

/**
 * POST STATE SCHEMA REGISTRY
 *
 * The generalization of `OFFICIAL_QUESTION_TAG_SLUG`: a code registry, keyed by
 * official tag slug, that decides a post's legal `state` values, its initial
 * state, and the allowed transitions between them. Each value is a kebab-case
 * slug (the machine identity, a closed vocabulary) carrying a `bucket`
 * (`active` | `closed`) used only for derived listing filters — values carry no
 * behavior flags (D3/D4). A value renders via the tag whose slug is `tagSlug`
 * (defaulting to the value slug); when no such tag exists the client renders the
 * raw slug. Reads are lenient (any string); writes are validated against this
 * registry server-side (D9).
 */

export type StateBucket = "active" | "closed";

export interface StateValue {
  /** Machine identity: a kebab-case slug, member of the schema's closed vocabulary. */
  slug: string;
  /** Derived-filter grouping. `closed` means concluded. */
  bucket: StateBucket;
  /** Tag slug used for rendering; defaults to `slug` when omitted. */
  tagSlug?: string;
}

export interface StateTransition {
  from: string;
  to: string;
}

export interface StateSchema {
  /** Initial state assigned when a post is created bearing the governing tag. */
  initial: string;
  values: StateValue[];
  transitions: StateTransition[];
}

/**
 * Build the open/closed-reasons transition set: `initial → reason` (close) and
 * `reason → initial` (reopen) for every closed value. There is no bare `closed`
 * value (D8); closing always writes a reason.
 */
function openClosedTransitions(
  initial: string,
  closedSlugList: string[],
): StateTransition[] {
  return closedSlugList.flatMap((slug) => [
    { from: initial, to: slug },
    { from: slug, to: initial },
  ]);
}

/** Question lifecycle: `open` · `solved` · `not-planned` · `duplicate` · `off-topic`. */
const QUESTION_SCHEMA: StateSchema = {
  initial: "open",
  values: [
    { slug: "open", bucket: "active" },
    { slug: "solved", bucket: "closed" },
    { slug: "not-planned", bucket: "closed" },
    { slug: "duplicate", bucket: "closed" },
    { slug: "off-topic", bucket: "closed" },
  ],
  transitions: openClosedTransitions("open", [
    "solved",
    "not-planned",
    "duplicate",
    "off-topic",
  ]),
};

/** Issue lifecycle: `open` · `completed` · `not-planned` · `duplicate`. */
const ISSUE_SCHEMA: StateSchema = {
  initial: "open",
  values: [
    { slug: "open", bucket: "active" },
    { slug: "completed", bucket: "closed" },
    { slug: "not-planned", bucket: "closed" },
    { slug: "duplicate", bucket: "closed" },
  ],
  transitions: openClosedTransitions("open", [
    "completed",
    "not-planned",
    "duplicate",
  ]),
};

/** Registry keyed by official tag slug. Per-realm custom schemas are deferred (D10). */
export const POST_STATE_SCHEMAS: Record<string, StateSchema> = {
  [OFFICIAL_QUESTION_TAG_SLUG]: QUESTION_SCHEMA,
  [OFFICIAL_ISSUE_TAG_SLUG]: ISSUE_SCHEMA,
};

/** Normalize a state slug at the write boundary: lowercase, `_` → `-`. */
export function normalizeStateSlug(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, "-");
}

/** Whether a tag slug governs a state schema (i.e. is a stateful tag). */
export function isStatefulTagSlug(tagSlug: string): boolean {
  return tagSlug in POST_STATE_SCHEMAS;
}

/** Resolve the schema governing a tag slug, or `undefined` when none. */
export function getStateSchema(tagSlug: string): StateSchema | undefined {
  return POST_STATE_SCHEMAS[tagSlug];
}

/** The tag slug a value renders through (defaults to the value slug). */
export function resolveValueTagSlug(value: StateValue): string {
  return value.tagSlug ?? value.slug;
}

function bucketSlugs(schema: StateSchema, bucket: StateBucket): string[] {
  return schema.values
    .filter((value) => value.bucket === bucket)
    .map((value) => value.slug);
}

/** Slugs in the `active` bucket of a schema (for `state IN (…)` filters). */
export function activeSlugs(schema: StateSchema): string[] {
  return bucketSlugs(schema, "active");
}

/** Slugs in the `closed` bucket of a schema (for `state IN (…)` filters). */
export function closedSlugs(schema: StateSchema): string[] {
  return bucketSlugs(schema, "closed");
}

/**
 * Union of bucket slugs across every registered schema. Used by bucket filters
 * that are not scoped to a single schema (e.g. a realm feed mixing genres).
 */
export function allBucketSlugs(bucket: StateBucket): string[] {
  const slugs = new Set<string>();
  for (const schema of Object.values(POST_STATE_SCHEMAS)) {
    for (const slug of bucketSlugs(schema, bucket)) slugs.add(slug);
  }
  return [...slugs];
}

/** Whether `slug` is a legal value of the schema. */
export function isLegalStateValue(schema: StateSchema, slug: string): boolean {
  return schema.values.some((value) => value.slug === slug);
}

/** Whether the schema allows a direct `from → to` transition. */
export function isLegalTransition(
  schema: StateSchema,
  from: string,
  to: string,
): boolean {
  return schema.transitions.some(
    (transition) => transition.from === from && transition.to === to,
  );
}

// ============================================================
// CONTRACT SHAPES (exposed for client rendering — read-lenient)
// ============================================================

export const stateBucketSchema = t.Union([
  t.Literal("active"),
  t.Literal("closed"),
]);

export const stateValueSchema = t.Object({
  slug: t.String(),
  bucket: stateBucketSchema,
  tagSlug: t.Optional(t.String()),
});

export const stateTransitionSchema = t.Object({
  from: t.String(),
  to: t.String(),
});

export const stateSchemaShape = t.Object({
  initial: t.String(),
  values: t.Array(stateValueSchema),
  transitions: t.Array(stateTransitionSchema),
});

/** Bucket filter for post listings. Derived; never stored on a post. */
export const stateBucketFilterSchema = stateBucketSchema;
