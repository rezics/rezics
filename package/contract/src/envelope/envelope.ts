import type { TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { t } from "elysia";

/**
 * Shared contract for persisted JSON columns.
 *
 * Rezics persists three classes of JSON. Enveloped JSON stores
 * self-describing `{ schema, version, ...body }` documents and owns a
 * permanent upgrade chain. Additive-compatible JSON is settings/metadata-style
 * payload with no envelope and an `@compat additive-only` schema discipline.
 * The exact marker is a JSDoc tag on the exported read schema:
 * `@compat additive-only`.
 *
 * Additive-only rules:
 * 1. Tolerant readers: read/parse schemas must not use
 *    `additionalProperties: false`; strictness is reserved for write DTOs.
 * 2. New fields are optional and have documented defaults. Optional fields
 *    never become required.
 * 3. Closed discriminated unions include an unknown-kind fallback so old
 *    readers degrade instead of crashing.
 * 4. Defaults are part of the contract and are immutable.
 * 5. Field types and semantics do not change, and removed field names are not
 *    reused. Add a new field instead.
 * 6. Start with string enums instead of booleans when a third state may appear.
 *
 * 追加兼容 JSON 使用无信封 payload，并通过导出读取 schema 上的
 * `@compat additive-only` JSDoc 标签约束演进。
 *
 * 追加规则：
 * 1. 读取/解析 schema 必须宽容，不能使用 `additionalProperties: false`；
 *    严格校验保留给写入 DTO。
 * 2. 新字段必须可选并记录默认语义；可选字段不能变为必填。
 * 3. 封闭的判别 union 必须包含未知 kind fallback，让旧读取方降级而非崩溃。
 * 4. 默认值是契约的一部分，不能改变。
 * 5. 字段类型和语义不能改变，已移除字段名不能复用；应添加新字段。
 * 6. 可能出现第三种状态时，优先使用字符串枚举而非布尔值。
 *
 * Exempt JSON is owned by an external format or is intentionally generic KV.
 * The class depends on backend consumption and expected evolution, not table
 * size.
 *
 * Enveloped JSON uses envelope metadata (`schema`, `version`) plus envelope
 * body (all remaining persisted payload). Avoid "header" for metadata because
 * zone config already has a business-level `header` object.
 *
 * Enveloped release flow: ship vN+1 schema and upgrade chain, accept mixed
 * versions while reads normalize, backfill stored rows to latest, verify old
 * rows are gone, then remove vN in a later release. Writes validate and persist
 * the latest version only. Reads dispatch by version and normally trust stored
 * body shape; full historical validation is development-only.
 *
 * Upgrade functions are pure, context-free transforms. They must not read from
 * the database, perform IO, or inspect environment. The same function serves
 * read normalization, backfill transforms, and client-side transforms where
 * applicable. If a change needs context, split it into additive steps.
 *
 * Additive-compatible JSON that later needs a breaking redesign uses
 * absence-as-v1: no `version` field means v1, and v2 introduces an envelope.
 */
export type JsonEnvelopeMetadata<
  TSchemaName extends string = string,
  TVersion extends number = number,
> = {
  schema: TSchemaName;
  version: TVersion;
};

export type EnvelopeUpgrade<TFrom, TLatest> = (value: TFrom) => TLatest;

export type EnvelopeVersion<TFrom, TLatest> = {
  version: number;
  schema: TSchema;
  upgrade: EnvelopeUpgrade<TFrom, TLatest>;
};

export type VersionedEnvelopeParser<TLatest> = {
  envelopeSchema: TSchema;
  latestSchema: TSchema;
  latestVersion: number;
  parse(value: unknown): TLatest | null;
  isLatest(value: unknown): value is TLatest;
};

export type VersionedEnvelopeParserOptions<TLatest> = {
  schemaName: string;
  latestVersion: number;
  latestSchema: TSchema;
  versions: readonly EnvelopeVersion<unknown, TLatest>[];
  fullValidation?: boolean | (() => boolean);
};

export function createVersionedEnvelopeParser<TLatest>(
  options: VersionedEnvelopeParserOptions<TLatest>,
): VersionedEnvelopeParser<TLatest> {
  if (options.versions.length === 0) {
    throw new Error("Envelope parser requires at least one version.");
  }

  const versions = new Map<number, EnvelopeVersion<unknown, TLatest>>();
  for (const version of options.versions) {
    assertContextFreeUpgrade(version.upgrade);
    versions.set(version.version, version);
  }

  const envelopeSchema = t.Union(
    options.versions.map((version) => version.schema) as [
      TSchema,
      ...TSchema[],
    ],
  );

  return {
    envelopeSchema,
    latestSchema: options.latestSchema,
    latestVersion: options.latestVersion,
    parse(value) {
      if (!isEnvelopeMetadata(value, options.schemaName)) return null;
      const version = versions.get(value.version);
      if (!version) return null;
      if (shouldRunFullValidation(options.fullValidation)) {
        if (!Value.Check(version.schema, value)) return null;
      }
      return version.upgrade(value);
    },
    isLatest(value): value is TLatest {
      return Value.Check(options.latestSchema, value);
    },
  };
}

function isEnvelopeMetadata(
  value: unknown,
  schemaName: string,
): value is JsonEnvelopeMetadata {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "schema" in value &&
    "version" in value &&
    (value as JsonEnvelopeMetadata).schema === schemaName &&
    typeof (value as JsonEnvelopeMetadata).version === "number"
  );
}

function shouldRunFullValidation(
  value: VersionedEnvelopeParserOptions<unknown>["fullValidation"],
): boolean {
  if (typeof value === "function") return value();
  if (typeof value === "boolean") return value;
  return process.env.NODE_ENV === "development";
}

function assertContextFreeUpgrade(upgrade: EnvelopeUpgrade<unknown, unknown>) {
  if (upgrade.length > 1) {
    throw new Error(
      "Envelope upgrade functions must accept only the stored value; split context-dependent changes into additive steps.",
    );
  }
}
