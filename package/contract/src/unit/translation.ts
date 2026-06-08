import { t } from "elysia";

// ============================================================
// UNIT TRANSLATION EXTRA SCHEMA
// ============================================================
// Typed shape of UnitTranslation.extra. Carries language-correlated
// presentation-layer metadata. Server mappers / API client / frontend
// readers SHOULD access these fields via this schema rather than reading
// `extra` as an untyped JSON blob.
// UnitTranslation.extra 的类型化结构。承载与语言相关的展示层元数据。
// 服务端 mapper / API client / 前端读取方应当通过此 schema 访问这些字段，
// 而不是把 `extra` 当作无类型的 JSON 块来读取。
//
// Unrecognized keys in `extra` are tolerated by the caller; only fields
// codified here are surfaced as flat DTO fields.
// 调用方会容忍 `extra` 中无法识别的键；只有在此处明确定义的字段才会
// 作为扁平的 DTO 字段被暴露出来。

export const unitTranslationExtraSchema = t.Object({
  coverUrl: t.Optional(t.String({ format: "uri" })),
});

export type UnitTranslationExtra =
  (typeof unitTranslationExtraSchema)["static"];

/**
 * Read a typed `coverUrl` from a possibly-untyped `extra` JSON value.
 * Returns `undefined` when the value is missing or the wrong shape.
 * 从可能无类型的 `extra` JSON 值中读取类型化的 `coverUrl`。
 * 当该值缺失或形状不正确时返回 `undefined`。
 */
export function readCoverUrlFromExtra(extra: unknown): string | undefined {
  if (!extra || typeof extra !== "object") return undefined;
  const value = (extra as Record<string, unknown>).coverUrl;
  return typeof value === "string" ? value : undefined;
}

/**
 * Merge a `coverUrl` into an existing `extra` JSON value, returning a new
 * object. Setting `undefined` removes the key.
 * 将 `coverUrl` 合并进已有的 `extra` JSON 值，并返回一个新对象。
 * 传入 `undefined` 会移除该键。
 */
export function withCoverUrl(
  extra: unknown,
  coverUrl: string | undefined,
): Record<string, unknown> {
  const base =
    extra && typeof extra === "object"
      ? { ...(extra as Record<string, unknown>) }
      : {};
  if (coverUrl === undefined) {
    delete base.coverUrl;
  } else {
    base.coverUrl = coverUrl;
  }
  return base;
}
