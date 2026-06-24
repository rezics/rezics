import { t } from "elysia";
import { contentDocSchema } from "./content/doc-v1";
import {
  editorialRevisionPayloadSchema,
  HistoryOutboxPayloadKind,
  structureEventPayloadSchema,
} from "./content/history";
import { bookshelfViewConfigSchema } from "./shelf/bookshelf";
import { tokenPermissionRoleSchema } from "./token/token";

const openObjectOptions = { additionalProperties: true } as const;

/**
 * Additive-compatible persisted JSON schemas are read-side contracts for plain
 * JSON columns with no envelope.
 *
 * @compat additive-only means:
 * 1. Read schemas stay tolerant and must not use `additionalProperties: false`;
 *    strictness belongs to write DTOs.
 *    读取 schema 保持宽容，不能使用 `additionalProperties: false`；严格校验属于写入 DTO。
 * 2. New fields are optional and their missing-value defaults are immutable.
 *    新字段必须是可选的，且缺失时的默认语义不可变。
 * 3. Kind-discriminated unions include an unknown-kind fallback.
 *    以 kind 区分的 union 必须包含未知 kind 的降级分支。
 * 4. Defaults are part of the persisted contract.
 *    默认值是持久化契约的一部分。
 * 5. Field types and meanings do not change; removed names are not reused.
 *    字段类型和语义不改变；已移除的名字不得复用。
 * 6. Prefer string enums to booleans when a third state may appear.
 *    可能出现第三种状态时优先使用字符串枚举，而不是布尔值。
 */
export const additiveJsonSchemaRules = true;

/**
 * @compat additive-only
 * Placeholder for currently unused object-shaped JSON columns. Missing or empty
 * means no typed keys are known yet; future keys must be added optionally.
 * 当前未使用的对象型 JSON 列占位。缺失或空对象表示尚无已知类型化字段；未来字段必须可选添加。
 */
export const emptyCompatObjectSchema = t.Object({}, openObjectOptions);

/**
 * `User.description`, `Comment.content`, translation descriptions, and content
 * bodies are ContentDoc envelopes, not additive-compatible JSON.
 */
export const persistedContentDocSchema = t.Union([contentDocSchema]);

/**
 * @compat additive-only
 * Main user permission currently tolerates both the older stored role-array
 * shape and the projected single-role shape. Missing role defaults to MEMBER at
 * projection boundaries.
 * Main 用户权限当前同时容忍较旧的 role 数组存储形态和投影后的单 role 形态。role 缺失时在投影边界默认为 MEMBER。
 */
export const userPermissionJsonSchema = t.Object(
  {
    role: t.Optional(
      t.Union([tokenPermissionRoleSchema, t.Array(tokenPermissionRoleSchema)]),
    ),
  },
  openObjectOptions,
);

/**
 * @compat additive-only
 * API token scopes are keyed by logical domain, with string permissions in each
 * domain. Missing domains grant no permissions.
 * API token scopes 以逻辑域为键，每个域内是字符串权限。缺失的域不授予权限。
 */
export const apiTokenScopesJsonSchema = t.Record(
  t.String(),
  t.Array(t.String()),
);

/**
 * @compat additive-only
 * User bookshelf display config is a bounded UI preference stored as one JSON
 * document because callers read and replace the whole layout together.
 * 用户书架显示配置是有界 UI 偏好，以单个 JSON 文档存储，因为调用方整体读取和
 * 替换布局。
 */
export const userBookshelfConfigJsonSchema = bookshelfViewConfigSchema;

/**
 * @compat additive-only
 * Unit-level extra currently has no authoritative typed fields. Missing or
 * empty means no typed metadata is present.
 * Unit 级 extra 当前没有权威类型化字段。缺失或空对象表示没有类型化元数据。
 */
export const unitExtraJsonSchema = emptyCompatObjectSchema;

/**
 * @compat additive-only
 * AI disclosure details are optional descriptive metadata. Missing booleans and
 * strings mean unspecified, not false.
 * AI 披露详情是可选描述元数据。缺失的布尔值和字符串表示未说明，而非 false。
 */
export const unitAiDisclosureDetailsJsonSchema = t.Object(
  {
    model: t.Optional(t.String()),
    provider: t.Optional(t.String()),
    reviewedByHuman: t.Optional(t.Boolean()),
    disclosedBy: t.Optional(t.String()),
    sourceStandard: t.Optional(t.String()),
  },
  openObjectOptions,
);

/**
 * @compat additive-only
 * Unit translation extra carries presentation metadata. Missing display fields
 * mean the normal Unit/translation fields remain authoritative.
 * Unit 翻译 extra 承载展示元数据。缺失展示字段表示继续以普通 Unit/translation 字段为准。
 */
export const unitTranslationExtraJsonSchema = t.Object(
  {
    coverUrl: t.Optional(t.String()),
    sourceTitle: t.Optional(t.String()),
    originalTitle: t.Optional(t.String()),
    overrideTitle: t.Optional(t.String()),
    displayTitle: t.Optional(t.String()),
  },
  openObjectOptions,
);

/**
 * @compat additive-only
 * Content translation provenance records importer/source hints. Missing fields
 * mean provenance is unknown.
 * 内容翻译 provenance 记录导入器/来源提示。缺失字段表示来源未知。
 */
export const contentTranslationProvenanceJsonSchema = t.Object(
  {
    importedFrom: t.Optional(t.String()),
  },
  openObjectOptions,
);

/**
 * @compat additive-only
 * Book extra currently has no authoritative typed fields. External references
 * belong to UnitExternalLink.
 * Book extra 当前没有权威类型化字段。外部引用归属 UnitExternalLink。
 */
export const bookExtraJsonSchema = emptyCompatObjectSchema;

/**
 * @compat additive-only
 * Game, media, series, shelf, link, post, and governance metadata JSON columns
 * currently have no stable typed fields. Missing or empty means no typed
 * metadata is present.
 * Game、media、series、shelf、link、post 与治理 metadata JSON 列当前没有稳定类型化字段。缺失或空对象表示没有类型化元数据。
 */
export const genericMetadataJsonSchema = emptyCompatObjectSchema;

/**
 * @compat additive-only
 * Hardware requirements are currently stored as an object without stable typed
 * fields. Missing keys mean unspecified requirements.
 * 硬件需求当前以对象存储，尚无稳定类型化字段。缺失键表示未说明对应需求。
 */
export const gameSystemRequirementHardwareJsonSchema = emptyCompatObjectSchema;

export const userUnitProgressExtraJsonSchema = emptyCompatObjectSchema;

/**
 * @compat additive-only
 * Last-read anchors currently carry display text. Missing means there is no
 * structured resume anchor beyond `lastReadNodeId`.
 * 最近阅读锚点当前承载显示文本。缺失表示除 `lastReadNodeId` 外没有结构化恢复锚点。
 */
export const lastReadAnchorJsonSchema = t.Object(
  {
    text: t.Optional(t.String()),
  },
  openObjectOptions,
);

/**
 * @compat additive-only
 * Score distributions are maps from score value strings to counts. Missing keys
 * mean zero count for that score.
 * 评分分布是分数字符串到计数的映射。缺失键表示该分数计数为 0。
 */
export const scoreDistributionJsonSchema = t.Record(t.String(), t.Integer());

/**
 * @compat additive-only
 * Score entry fields are per-field score values. Missing fields mean the entry
 * did not rate that dimension.
 * 评分记录 fields 是各维度分值。缺失字段表示该记录未评价对应维度。
 */
export const scoreEntryFieldsJsonSchema = t.Record(t.String(), t.Integer());

/**
 * @compat additive-only
 * Score aggregate fields are per-field aggregate totals. Missing fields mean
 * no ratings have contributed to that dimension.
 * 评分聚合 fields 是各维度聚合总量。缺失字段表示该维度尚无评分贡献。
 */
export const scoreAggregateFieldsJsonSchema = t.Record(
  t.String(),
  t.Object(
    {
      total: t.Optional(t.Integer()),
      count: t.Optional(t.Integer()),
      dist: t.Optional(scoreDistributionJsonSchema),
    },
    openObjectOptions,
  ),
);

/**
 * @compat additive-only
 * Content structure paths are JSON arrays, not exempt blobs. Empty arrays mean
 * a root-level anchor.
 * 内容结构 path 是 JSON 数组，不是豁免 blob。空数组表示根级锚点。
 */
export const contentStructurePathJsonSchema = t.Array(t.Integer());

/**
 * @compat additive-only
 * Content structure title paths are JSON arrays of display titles. Empty arrays
 * mean a root-level anchor.
 * 内容结构 title path 是显示标题数组。空数组表示根级锚点。
 */
export const contentStructureTitlePathJsonSchema = t.Array(t.String());

const unknownHistoryOutboxPayloadSchema = t.Object(
  {
    kind: t.String(),
  },
  openObjectOptions,
);

/**
 * @compat additive-only
 * History outbox payloads are short-lived internal protocol messages, but still
 * persisted JSON. Unknown `kind` values are retained as opaque payloads so older
 * readers can skip work instead of crashing.
 * History outbox payload 是短生命周期内部协议消息，但仍是持久化 JSON。未知 `kind` 会作为不透明 payload 保留，使旧读取方跳过而非崩溃。
 */
export const historyOutboxPayloadJsonSchema = t.Union([
  t.Object(
    {
      kind: t.Literal(HistoryOutboxPayloadKind.EDITORIAL_REVISION),
      revision: editorialRevisionPayloadSchema,
    },
    openObjectOptions,
  ),
  t.Object(
    {
      kind: t.Literal(HistoryOutboxPayloadKind.STRUCTURE_EVENT),
      event: structureEventPayloadSchema,
    },
    openObjectOptions,
  ),
  t.Object(
    {
      kind: t.Literal(HistoryOutboxPayloadKind.LOCK_MUTATION),
      revision: editorialRevisionPayloadSchema,
    },
    openObjectOptions,
  ),
  t.Object(
    {
      kind: t.Literal(HistoryOutboxPayloadKind.COLLABORATOR_MUTATION),
      revision: editorialRevisionPayloadSchema,
    },
    openObjectOptions,
  ),
  unknownHistoryOutboxPayloadSchema,
]);
