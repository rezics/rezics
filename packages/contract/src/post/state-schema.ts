import { t } from "elysia";
import { OFFICIAL_ISSUE_TAG_SLUG } from "../tag/seed-tags";
import { OFFICIAL_QUESTION_TAG_SLUG } from "./post";

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
 *
 * 帖子状态 schema 注册表。
 *
 * 这是 `OFFICIAL_QUESTION_TAG_SLUG` 的泛化：一个以官方 tag slug 为键的代码
 * 注册表，用于决定帖子合法的 `state` 取值、初始状态以及它们之间允许的转换。
 * 每个取值是一个 kebab-case slug（机器标识，封闭词表），携带一个 `bucket`
 * （`active` | `closed`），仅用于派生的列表过滤——取值不携带任何行为标志
 * （D3/D4）。一个取值通过 slug 为 `tagSlug` 的 tag 渲染（默认取值本身的
 * slug）；当不存在这样的 tag 时，客户端渲染原始 slug。读取是宽松的（任意
 * 字符串）；写入在服务端针对此注册表校验（D9）。
 */

export type StateBucket = "active" | "closed";

export interface StateValue {
  /**
   * Machine identity: a kebab-case slug, member of the schema's closed vocabulary.
   * 机器标识：一个 kebab-case slug，是该 schema 封闭词表的成员。
   */
  slug: string;
  /**
   * Derived-filter grouping. `closed` means concluded.
   * 派生过滤的分组。`closed` 表示已结束。
   */
  bucket: StateBucket;
  /**
   * Tag slug used for rendering; defaults to `slug` when omitted.
   * 用于渲染的 tag slug；省略时默认为 `slug`。
   */
  tagSlug?: string;
}

export interface StateTransition {
  from: string;
  to: string;
}

export interface StateSchema {
  /**
   * Initial state assigned when a post is created bearing the governing tag.
   * 当帖子在创建时携带主控 tag 时所分配的初始状态。
   */
  initial: string;
  values: StateValue[];
  transitions: StateTransition[];
}

/**
 * Build the open/closed-reasons transition set: `initial → reason` (close) and
 * `reason → initial` (reopen) for every closed value. There is no bare `closed`
 * value (D8); closing always writes a reason.
 *
 * 构建开放/关闭原因的转换集合：为每个 closed 取值生成 `initial → reason`
 * （关闭）与 `reason → initial`（重新打开）。不存在裸的 `closed` 取值
 * （D8）；关闭时始终写入一个原因。
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

/**
 * Question lifecycle: `open` · `solved` · `not-planned` · `duplicate` · `off-topic`.
 * 问题生命周期：`open` · `solved` · `not-planned` · `duplicate` · `off-topic`。
 */
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

/**
 * Issue lifecycle: `open` · `completed` · `not-planned` · `duplicate`.
 * 议题生命周期：`open` · `completed` · `not-planned` · `duplicate`。
 */
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

/**
 * Registry keyed by official tag slug. Per-realm custom schemas are deferred (D10).
 * 以官方 tag slug 为键的注册表。按 realm 定制的 schema 暂缓实现（D10）。
 */
export const POST_STATE_SCHEMAS: Record<string, StateSchema> = {
  [OFFICIAL_QUESTION_TAG_SLUG]: QUESTION_SCHEMA,
  [OFFICIAL_ISSUE_TAG_SLUG]: ISSUE_SCHEMA,
};

/**
 * Normalize a state slug at the write boundary: lowercase, `_` → `-`.
 * 在写入边界规范化状态 slug：转为小写，`_` → `-`。
 */
export function normalizeStateSlug(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, "-");
}

/**
 * Whether a tag slug governs a state schema (i.e. is a stateful tag).
 * 某个 tag slug 是否主控一个状态 schema（即是否为有状态的 tag）。
 */
export function isStatefulTagSlug(tagSlug: string): boolean {
  return tagSlug in POST_STATE_SCHEMAS;
}

/**
 * Resolve the schema governing a tag slug, or `undefined` when none.
 * 解析某个 tag slug 所对应的主控 schema，无则返回 `undefined`。
 */
export function getStateSchema(tagSlug: string): StateSchema | undefined {
  return POST_STATE_SCHEMAS[tagSlug];
}

/**
 * The tag slug a value renders through (defaults to the value slug).
 * 某个取值用于渲染的 tag slug（默认为该取值本身的 slug）。
 */
export function resolveValueTagSlug(value: StateValue): string {
  return value.tagSlug ?? value.slug;
}

function bucketSlugs(schema: StateSchema, bucket: StateBucket): string[] {
  return schema.values
    .filter((value) => value.bucket === bucket)
    .map((value) => value.slug);
}

/**
 * Slugs in the `active` bucket of a schema (for `state IN (…)` filters).
 * schema 中 `active` 桶内的 slug 列表（用于 `state IN (…)` 过滤）。
 */
export function activeSlugs(schema: StateSchema): string[] {
  return bucketSlugs(schema, "active");
}

/**
 * Slugs in the `closed` bucket of a schema (for `state IN (…)` filters).
 * schema 中 `closed` 桶内的 slug 列表（用于 `state IN (…)` 过滤）。
 */
export function closedSlugs(schema: StateSchema): string[] {
  return bucketSlugs(schema, "closed");
}

/**
 * Union of bucket slugs across every registered schema. Used by bucket filters
 * that are not scoped to a single schema (e.g. a realm feed mixing genres).
 *
 * 所有已注册 schema 中某个桶 slug 的并集。供未限定到单一 schema 的桶过滤
 * 使用（例如混合多种类型的 realm 信息流）。
 */
export function allBucketSlugs(bucket: StateBucket): string[] {
  const slugs = new Set<string>();
  for (const schema of Object.values(POST_STATE_SCHEMAS)) {
    for (const slug of bucketSlugs(schema, bucket)) slugs.add(slug);
  }
  return [...slugs];
}

/**
 * Whether `slug` is a legal value of the schema.
 * `slug` 是否为该 schema 的合法取值。
 */
export function isLegalStateValue(schema: StateSchema, slug: string): boolean {
  return schema.values.some((value) => value.slug === slug);
}

/**
 * Whether the schema allows a direct `from → to` transition.
 * 该 schema 是否允许从 `from → to` 的直接转换。
 */
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
// 契约 shape（暴露给客户端渲染——读取宽松）
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

/**
 * Bucket filter for post listings. Derived; never stored on a post.
 * 帖子列表的桶过滤器。派生而来；从不存储在帖子上。
 */
export const stateBucketFilterSchema = stateBucketSchema;
