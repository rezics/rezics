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
