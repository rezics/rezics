import { t } from "elysia";
import type { UnitType } from "../unit/unit";

export const CONTENT_DOC_SCHEMA = "rezics.content" as const;
export const CONTENT_DOC_V1_VERSION = 1 as const;
export const CONTENT_DOC_VERSION = CONTENT_DOC_V1_VERSION;

export type UnitRef = {
  unitId: string;
  unitType?: UnitType;
};

export const unitRefSourceSchema = t.Object(
  {
    unitId: t.String(),
    unitType: t.Optional(t.String()),
  },
  { additionalProperties: false },
);

export const markdownContentBlockSchema = t.Object(
  {
    type: t.Literal("markdown"),
    source: t.String(),
  },
  { additionalProperties: false },
);

export const pollContentBlockSchema = t.Object(
  {
    type: t.Literal("poll"),
    source: t.String(),
  },
  { additionalProperties: false },
);

export const unitRefContentBlockSchema = t.Object(
  {
    type: t.Literal("unit-ref"),
    source: unitRefSourceSchema,
  },
  { additionalProperties: false },
);

export const contentBlockSchema = markdownContentBlockSchema;

export const contentDocRegionBlockSchema = t.Union([
  pollContentBlockSchema,
  unitRefContentBlockSchema,
]);

export const contentDocSchema = t.Object(
  {
    schema: t.Literal(CONTENT_DOC_SCHEMA),
    version: t.Literal(CONTENT_DOC_V1_VERSION),
    beforeMain: t.Optional(t.Array(contentDocRegionBlockSchema)),
    main: markdownContentBlockSchema,
    afterMain: t.Optional(t.Array(contentDocRegionBlockSchema)),
  },
  { additionalProperties: false },
);

export const contentDocEnvelopeSchema = t.Union([contentDocSchema]);

export type MarkdownContentBlock =
  (typeof markdownContentBlockSchema)["static"];
export type PollContentBlock = (typeof pollContentBlockSchema)["static"];
export type UnitRefContentBlock = (typeof unitRefContentBlockSchema)["static"];
export type ContentBlock = (typeof contentBlockSchema)["static"];
export type ContentDocRegionBlock =
  (typeof contentDocRegionBlockSchema)["static"];
export type ContentDoc = (typeof contentDocSchema)["static"];

// Content docs are enveloped JSON. Backend reads mostly store them opaquely and
// derive projections on write; when content versions advance, the shared
// envelope module owns the pure upgrade-chain shape that can also run client-side.
// Content doc 是信封化 JSON。后端读取路径大多不透明存储，并在写入时派生投影；
// 当内容版本演进时，共享 envelope 模块负责也可在客户端运行的纯升级链形态。

// Server write paths intentionally accept opaque ContentDoc-shaped JSON. They
// persist the object as submitted and only interpret supported fields such as
// `main.source` after storage; preferred-shape reporting lives in helpers.
// 服务端写入路径有意接受不透明的 ContentDoc 形态 JSON。它们按提交原样持久化
// 该对象，仅在存储后解析诸如 `main.source` 等受支持的字段；首选形态的校验
// 逻辑位于辅助函数中。
export const contentDocWriteSchema = t.Record(t.String(), t.Any());

export function mainMarkdownSource(value: unknown): string | null {
  if (
    isRecord(value) &&
    isRecord(value.main) &&
    value.main.type === "markdown" &&
    typeof value.main.source === "string"
  ) {
    return value.main.source;
  }
  return null;
}

export function markdownContentDoc(source: string): ContentDoc {
  return {
    schema: CONTENT_DOC_SCHEMA,
    version: CONTENT_DOC_VERSION,
    main: { type: "markdown", source },
  };
}

export function pollContentBlock(pollUnitId: string): PollContentBlock {
  return { type: "poll", source: pollUnitId };
}

export function unitRefContentBlock(unitRef: UnitRef): UnitRefContentBlock {
  return { type: "unit-ref", source: unitRef };
}

export function markdownContentDocWithPoll(
  source: string,
  pollUnitId: string,
  region: "beforeMain" | "afterMain" = "afterMain",
): ContentDoc {
  return {
    ...markdownContentDoc(source),
    [region]: [pollContentBlock(pollUnitId)],
  };
}

export function extractPollUnitIdsFromContentDoc(value: unknown): string[] {
  if (!isRecord(value)) return [];
  const ids = new Set<string>();
  for (const regionName of ["beforeMain", "afterMain"] as const) {
    const region = value[regionName];
    if (!Array.isArray(region)) continue;
    for (const block of region) {
      if (
        isRecord(block) &&
        block.type === "poll" &&
        typeof block.source === "string" &&
        block.source.length > 0
      ) {
        ids.add(block.source);
      }
    }
  }
  return [...ids];
}

export function extractUnitRefIdsFromContentDoc(value: unknown): string[] {
  if (!isRecord(value)) return [];
  const ids = new Set<string>();
  for (const regionName of ["beforeMain", "afterMain"] as const) {
    const region = value[regionName];
    if (!Array.isArray(region)) continue;
    for (const block of region) {
      const source = isRecord(block) ? block.source : null;
      if (
        isRecord(block) &&
        block.type === "unit-ref" &&
        isRecord(source) &&
        typeof source.unitId === "string" &&
        source.unitId.length > 0
      ) {
        ids.add(source.unitId);
      }
    }
  }
  return [...ids];
}

export function contentDocMarkdownFallback(value: unknown): string {
  if (typeof value === "string") return value;
  const mainSource = mainMarkdownSource(value);
  if (mainSource) return mainSource;
  if (value == null) return "";
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
