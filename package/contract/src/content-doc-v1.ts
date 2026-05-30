import { t } from "elysia";
import type { UnitType } from "./unit";

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

export type MarkdownContentBlock =
  (typeof markdownContentBlockSchema)["static"];
export type PollContentBlock = (typeof pollContentBlockSchema)["static"];
export type UnitRefContentBlock = (typeof unitRefContentBlockSchema)["static"];
export type ContentBlock = (typeof contentBlockSchema)["static"];
export type ContentDocRegionBlock =
  (typeof contentDocRegionBlockSchema)["static"];
export type ContentDoc = (typeof contentDocSchema)["static"];

// Server write paths intentionally accept opaque ContentDoc-shaped JSON. They
// persist the object as submitted and only interpret supported fields such as
// `main.source` after storage; preferred-shape reporting lives in helpers.
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
