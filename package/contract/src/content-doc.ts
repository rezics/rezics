import { Value } from "@sinclair/typebox/value";
import { t } from "elysia";
import type { UnitType } from "./unit";

export const CONTENT_DOC_SCHEMA = "rezics.content" as const;
export const CONTENT_DOC_VERSION = 1 as const;

export type SlotId = string;

export type UnitRef = {
  unitId: string;
  unitType?: UnitType;
};

export const unitRefSchema = t.Object({
  unitId: t.String(),
  unitType: t.Optional(t.String()),
});

export const markdownContentBlockSchema = t.Object({
  type: t.Literal("markdown"),
  source: t.String(),
});

export const contentBlockSchema = markdownContentBlockSchema;

export type ContentBlock = (typeof contentBlockSchema)["static"];

export const slotRenderCardSizeSchema = t.Union([
  t.Literal("compact"),
  t.Literal("regular"),
  t.Literal("rich"),
]);

export const unitRefSlotSchema = t.Object({
  type: t.Literal("unit-ref"),
  ref: unitRefSchema,
  render: t.Optional(
    t.Object({
      view: t.Optional(
        t.Union([
          t.Literal("card"),
          t.Literal("chip"),
          t.Literal("hover-preview"),
        ]),
      ),
      cardSize: t.Optional(slotRenderCardSizeSchema),
    }),
  ),
});

export const entityListSlotSchema = t.Object({
  type: t.Literal("entity-list"),
  refs: t.Array(unitRefSchema),
  title: t.Optional(contentBlockSchema),
  render: t.Optional(
    t.Object({
      layout: t.Optional(
        t.Union([
          t.Literal("horizontal"),
          t.Literal("vertical"),
          t.Literal("grid"),
          t.Literal("table"),
        ]),
      ),
      cardSize: t.Optional(slotRenderCardSizeSchema),
      groupBy: t.Optional(t.Union([t.Literal("unitType"), t.Literal("none")])),
    }),
  ),
});

export const infoboxDateValueSchema = t.Object({
  type: t.Literal("date"),
  iso: t.String(),
});

export const infoboxLinkValueSchema = t.Object({
  type: t.Literal("link"),
  url: t.String(),
  label: t.Optional(t.String()),
});

export const infoboxValueSchema = t.Union([
  contentBlockSchema,
  unitRefSchema,
  t.Array(unitRefSchema),
  infoboxDateValueSchema,
  infoboxLinkValueSchema,
]);

export const infoboxSlotSchema = t.Object({
  type: t.Literal("infobox"),
  rows: t.Array(
    t.Object({
      label: contentBlockSchema,
      value: infoboxValueSchema,
    }),
  ),
});

export const unknownSlotSchema = t.Intersect([
  t.Object({
    type: t.String(),
  }),
  t.Record(t.String(), t.Any()),
]);

export const slotSchema = t.Union([
  unitRefSlotSchema,
  entityListSlotSchema,
  infoboxSlotSchema,
  unknownSlotSchema,
]);

export type UnitRefSlot = (typeof unitRefSlotSchema)["static"];
export type EntityListSlot = (typeof entityListSlotSchema)["static"];
export type InfoboxSlot = (typeof infoboxSlotSchema)["static"];
export type UnknownSlot = (typeof unknownSlotSchema)["static"];
export type Slot = UnitRefSlot | EntityListSlot | InfoboxSlot | UnknownSlot;

export const contentDocLayoutRegionSchema = t.Union([
  t.Literal("main"),
  t.Literal("aside"),
  t.Literal("after-main"),
  t.Literal("before-main"),
]);

export const contentDocLayoutEntrySchema = t.Object({
  region: contentDocLayoutRegionSchema,
  slotId: t.String(),
});

export const contentDocSchema = t.Object({
  schema: t.Literal(CONTENT_DOC_SCHEMA),
  version: t.Literal(CONTENT_DOC_VERSION),
  main: contentBlockSchema,
  slots: t.Optional(t.Record(t.String(), slotSchema)),
  layout: t.Optional(t.Array(contentDocLayoutEntrySchema)),
});

export type ContentDoc = (typeof contentDocSchema)["static"];
export type ContentDocLayoutEntry =
  (typeof contentDocLayoutEntrySchema)["static"];

// Server write paths intentionally accept opaque ContentDoc-shaped JSON. They
// persist the object as submitted and only interpret supported fields such as
// `main.source` after storage; preferred-shape reporting lives in helpers.
export const contentDocWriteSchema = t.Record(t.String(), t.Any());

export const contentDocDirectiveGrammar = {
  block: ':::slot{ id="<slotId>" [render-attr=value ...] } ... :::',
  inline: ":slot[<slotId>]{ [render-attr=value ...] }",
  dataSource: "content.slots[slotId]",
} as const;

export type ContentDocPreferredIssueCode =
  | "invalid-schema"
  | "invalid-version"
  | "invalid-shape"
  | "slot-placement-conflict";

export type ContentDocPreferredIssue = {
  code: ContentDocPreferredIssueCode;
  path: string;
  message: string;
};

export type ContentDocPreferredValidation = {
  valid: boolean;
  issues: ContentDocPreferredIssue[];
};

const BLOCK_SLOT_DIRECTIVE_PATTERN =
  /:::\s*slot\s*\{[^}]*\bid\s*=\s*["']?([^"'\s}]+)["']?[^}]*\}/g;
const INLINE_SLOT_DIRECTIVE_PATTERN = /:slot\[([^\]]+)\]\s*\{/g;

export function scanInlineSlotIds(markdown: string): string[] {
  const slotIds = new Set<string>();
  for (const match of markdown.matchAll(BLOCK_SLOT_DIRECTIVE_PATTERN)) {
    if (match[1]) slotIds.add(match[1]);
  }
  for (const match of markdown.matchAll(INLINE_SLOT_DIRECTIVE_PATTERN)) {
    if (match[1]) slotIds.add(match[1]);
  }
  return [...slotIds];
}

export function validateContentDocPreferredShape(
  value: unknown,
): ContentDocPreferredValidation {
  const issues: ContentDocPreferredIssue[] = [];

  if (!isRecord(value)) {
    return {
      valid: false,
      issues: [
        {
          code: "invalid-shape",
          path: "",
          message: "ContentDoc must be an object.",
        },
      ],
    };
  }

  if (value.schema !== CONTENT_DOC_SCHEMA) {
    issues.push({
      code: "invalid-schema",
      path: "schema",
      message: `ContentDoc schema must be ${CONTENT_DOC_SCHEMA}.`,
    });
  }

  if (value.version !== CONTENT_DOC_VERSION) {
    issues.push({
      code: "invalid-version",
      path: "version",
      message: `ContentDoc version must be ${CONTENT_DOC_VERSION}.`,
    });
  }

  if (!Value.Check(contentDocSchema, value)) {
    issues.push({
      code: "invalid-shape",
      path: "",
      message: "ContentDoc does not match the preferred v1 shape.",
    });
  }

  const mainSource =
    isRecord(value.main) && typeof value.main.source === "string"
      ? value.main.source
      : "";
  const inlineSlotIds = new Set(scanInlineSlotIds(mainSource));
  const layoutSlotIds = new Set(
    Array.isArray(value.layout)
      ? value.layout
          .map((entry) =>
            isRecord(entry) && typeof entry.slotId === "string"
              ? entry.slotId
              : undefined,
          )
          .filter((slotId): slotId is string => Boolean(slotId))
      : [],
  );

  for (const slotId of inlineSlotIds) {
    if (layoutSlotIds.has(slotId)) {
      issues.push({
        code: "slot-placement-conflict",
        path: `slots.${slotId}`,
        message: `Slot "${slotId}" is referenced inline and in layout.`,
      });
    }
  }

  return { valid: issues.length === 0, issues };
}

export function scanRefs(doc: ContentDoc): UnitRef[] {
  const refs = new Map<string, UnitRef>();
  const addRef = (value: unknown) => {
    if (!isUnitRef(value)) return;
    refs.set(`${value.unitType ?? ""}:${value.unitId}`, {
      unitId: value.unitId,
      ...(value.unitType ? { unitType: value.unitType } : {}),
    });
  };

  const slots = doc.slots ?? {};
  for (const slot of Object.values(slots)) {
    if (!isRecord(slot)) continue;

    switch (slot.type) {
      case "unit-ref":
        addRef(slot.ref);
        break;
      case "entity-list":
        if (Array.isArray(slot.refs)) slot.refs.forEach(addRef);
        break;
      case "infobox":
        if (Array.isArray(slot.rows)) {
          for (const row of slot.rows) {
            if (!isRecord(row)) continue;
            const { value } = row;
            if (Array.isArray(value)) value.forEach(addRef);
            else addRef(value);
          }
        }
        break;
      default:
        // Extension point: add future ref-bearing slot types here.
        break;
    }
  }

  return [...refs.values()];
}

export function extractText(doc: ContentDoc): string {
  const parts: string[] = [];
  addContentBlockText(parts, doc.main);

  const slots = doc.slots ?? {};
  for (const slot of Object.values(slots)) {
    if (!isRecord(slot)) continue;

    switch (slot.type) {
      case "entity-list":
        addContentBlockText(parts, slot.title);
        break;
      case "infobox":
        if (Array.isArray(slot.rows)) {
          for (const row of slot.rows) {
            if (!isRecord(row)) continue;
            addContentBlockText(parts, row.label);
            addContentBlockText(parts, row.value);
            if (isRecord(row.value) && row.value.type === "link") {
              if (typeof row.value.label === "string")
                parts.push(row.value.label);
            }
          }
        }
        break;
      default:
        break;
    }
  }

  return parts.filter(Boolean).join("\n");
}

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

function addContentBlockText(parts: string[], value: unknown) {
  if (
    isRecord(value) &&
    value.type === "markdown" &&
    typeof value.source === "string"
  ) {
    parts.push(value.source);
  }
}

function isUnitRef(value: unknown): value is UnitRef {
  return (
    isRecord(value) &&
    typeof value.unitId === "string" &&
    (value.unitType === undefined || typeof value.unitType === "string")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
