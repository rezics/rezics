import type { UnitRevisionPathCompareResponse } from "@rezics/contract";
import { diffArrays, diffJson, diffLines } from "diff";

export type DiffPart = {
  type: "equal" | "added" | "removed";
  value: string;
};

export type HistoryFieldChange =
  | {
      kind: "scalar";
      path: string;
      before: unknown;
      after: unknown;
    }
  | {
      kind: "markdown";
      path: string;
      before: string;
      after: string;
      lineParts: DiffPart[];
      inlineParts: DiffPart[];
    }
  | {
      kind: "collection";
      path: string;
      added: unknown[];
      removed: unknown[];
      updated: Array<{ key: string; before: unknown; after: unknown }>;
    }
  | {
      kind: "raw";
      path: string;
      before?: unknown;
      after?: unknown;
      rawParts?: DiffPart[];
      hidden: boolean;
    };

export type HistoryCompareResult = {
  changes: HistoryFieldChange[];
};

export type RevisionComparePair = {
  baseSequence: number;
  targetSequence: number;
};

const TEXT_SOURCE_FIELD_NAMES = new Set([
  "summary",
  "description",
  "body",
  "content",
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
    .join(",")}}`;
}

function toPartType(part: { added?: boolean; removed?: boolean }) {
  if (part.added) return "added" as const;
  if (part.removed) return "removed" as const;
  return "equal" as const;
}

function textSourceLeaf(
  path: string,
  before: unknown,
  after: unknown,
): { before: string; after: string } | null {
  if (typeof before !== "string" || typeof after !== "string") return null;

  const segments = path.split(".");
  const fieldName = segments.at(-1) ?? path;
  if (TEXT_SOURCE_FIELD_NAMES.has(fieldName)) return { before, after };

  const isNestedSourceLeaf =
    fieldName === "source" &&
    segments
      .slice(0, -1)
      .some((segment) => TEXT_SOURCE_FIELD_NAMES.has(segment));
  return isNestedSourceLeaf ? { before, after } : null;
}

export function createMarkdownLineDiff(
  before: string,
  after: string,
): DiffPart[] {
  return diffLines(before, after).map((part) => ({
    type: toPartType(part),
    value: part.value,
  }));
}

function segmentText(value: string, locale?: string): string[] {
  const Segmenter = Intl.Segmenter;
  if (!Segmenter) return Array.from(value);
  return Array.from(
    new Segmenter(locale, { granularity: "word" }).segment(value),
    (segment) => segment.segment,
  );
}

export function createInlineTokenDiff(
  before: string,
  after: string,
  locale?: string,
): DiffPart[] {
  return diffArrays(
    segmentText(before, locale),
    segmentText(after, locale),
  ).map((part) => ({
    type: toPartType(part),
    value: part.value.join(""),
  }));
}

function identityOf(value: unknown): string {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  return String(
    record.unitId ??
      record.entityId ??
      record.tagUnitId ??
      record.subjectUnitId ??
      record.language ??
      record.id ??
      stableStringify(value),
  );
}

function compareCollection(
  path: string,
  beforeValue: unknown,
  afterValue: unknown,
): HistoryFieldChange | null {
  const before = Array.isArray(beforeValue) ? beforeValue : [];
  const after = Array.isArray(afterValue) ? afterValue : [];
  const beforeByKey = new Map(before.map((item) => [identityOf(item), item]));
  const afterByKey = new Map(after.map((item) => [identityOf(item), item]));
  const added = after.filter((item) => !beforeByKey.has(identityOf(item)));
  const removed = before.filter((item) => !afterByKey.has(identityOf(item)));
  const updated = after
    .map((item) => {
      const key = identityOf(item);
      const previous = beforeByKey.get(key);
      if (!previous || stableStringify(previous) === stableStringify(item)) {
        return null;
      }
      return { key, before: previous, after: item };
    })
    .filter((item): item is { key: string; before: unknown; after: unknown } =>
      Boolean(item),
    );

  if (added.length === 0 && removed.length === 0 && updated.length === 0) {
    return null;
  }
  return { kind: "collection", path, added, removed, updated };
}

function compareKnownRecord(
  path: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): HistoryFieldChange[] {
  const changes: HistoryFieldChange[] = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const fieldPath = `${path}.${key}`;
    const beforeValue = before[key];
    const afterValue = after[key];
    if (stableStringify(beforeValue) === stableStringify(afterValue)) continue;
    const textSource = textSourceLeaf(fieldPath, beforeValue, afterValue);
    if (textSource) {
      changes.push({
        kind: "markdown",
        path: fieldPath,
        before: textSource.before,
        after: textSource.after,
        lineParts: createMarkdownLineDiff(textSource.before, textSource.after),
        inlineParts: createInlineTokenDiff(textSource.before, textSource.after),
      });
    } else if (
      beforeValue == null ||
      afterValue == null ||
      typeof beforeValue !== "object" ||
      typeof afterValue !== "object"
    ) {
      changes.push({
        kind: "scalar",
        path: fieldPath,
        before: beforeValue,
        after: afterValue,
      });
    } else if (!Array.isArray(beforeValue) && !Array.isArray(afterValue)) {
      changes.push(
        ...compareKnownRecord(
          fieldPath,
          asRecord(beforeValue),
          asRecord(afterValue),
        ),
      );
    }
  }
  return changes;
}

function rawChange(
  path: string,
  before: unknown,
  after: unknown,
  allowRaw: boolean,
): HistoryFieldChange {
  const beforeDiffValue = rawDiffValue(before);
  const afterDiffValue = rawDiffValue(after);
  return {
    kind: "raw",
    path,
    before: allowRaw ? before : undefined,
    after: allowRaw ? after : undefined,
    rawParts: allowRaw
      ? diffJson(beforeDiffValue, afterDiffValue).map((part) => ({
          type: toPartType(part),
          value: part.value,
        }))
      : undefined,
    hidden: !allowRaw,
  };
}

function rawDiffValue(value: unknown): string | object {
  return typeof value === "object" && value !== null ? value : String(value);
}

export function compareRevisionSlots(
  beforeSlots: Record<string, unknown>,
  afterSlots: Record<string, unknown>,
  options: { allowRaw?: boolean } = {},
): HistoryCompareResult {
  const changes: HistoryFieldChange[] = [];
  const allowRaw = options.allowRaw === true;

  for (const slot of new Set([
    ...Object.keys(beforeSlots),
    ...Object.keys(afterSlots),
  ])) {
    const before = beforeSlots[slot];
    const after = afterSlots[slot];
    if (stableStringify(before) === stableStringify(after)) continue;

    if (["tags", "subjects", "credits", "supportLanguages"].includes(slot)) {
      const collection = compareCollection(slot, before, after);
      if (collection) changes.push(collection);
    } else if (slot === "extension" || slot === "unit") {
      changes.push(
        ...compareKnownRecord(slot, asRecord(before), asRecord(after)),
      );
    } else {
      changes.push(rawChange(slot, before, after, allowRaw));
    }
  }

  return { changes };
}

export function compareRevisionPathSnapshots(
  response: UnitRevisionPathCompareResponse,
  options: { allowRaw?: boolean } = {},
): HistoryCompareResult {
  const allowRaw = options.allowRaw === true;
  const changes = response.changes.flatMap((entry): HistoryFieldChange[] => {
    const before = entry.base.value;
    const after = entry.target.value;
    if (stableStringify(before) === stableStringify(after)) return [];

    const textSource = textSourceLeaf(entry.path, before, after);
    if (textSource) {
      return [
        {
          kind: "markdown",
          path: entry.path,
          before: textSource.before,
          after: textSource.after,
          lineParts: createMarkdownLineDiff(
            textSource.before,
            textSource.after,
          ),
          inlineParts: createInlineTokenDiff(
            textSource.before,
            textSource.after,
          ),
        },
      ];
    }

    if (Array.isArray(before) || Array.isArray(after)) {
      const collection = compareCollection(entry.path, before, after);
      return collection ? [collection] : [];
    }

    if (
      before == null ||
      after == null ||
      typeof before !== "object" ||
      typeof after !== "object"
    ) {
      return [{ kind: "scalar", path: entry.path, before, after }];
    }

    return [rawChange(entry.path, before, after, allowRaw)];
  });

  return { changes };
}

export function resolveRevisionComparePair(
  sequences: readonly number[],
  selectedSequence: number,
): RevisionComparePair | null {
  const ordered = [...new Set(sequences)]
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
  const selectedIndex = ordered.indexOf(selectedSequence);
  if (selectedIndex < 0 || ordered.length < 2) return null;

  const targetSequence =
    selectedIndex === 0 ? ordered[0] : ordered[selectedIndex - 1];
  const baseSequence = selectedIndex === 0 ? ordered[1] : selectedSequence;

  if (
    baseSequence === undefined ||
    targetSequence === undefined ||
    baseSequence === targetSequence
  ) {
    return null;
  }

  return { baseSequence, targetSequence };
}
