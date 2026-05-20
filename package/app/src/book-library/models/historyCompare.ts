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

const MARKDOWN_FIELD_NAMES = new Set(["summary", "description", "body"]);

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
    if (
      MARKDOWN_FIELD_NAMES.has(key) &&
      typeof beforeValue === "string" &&
      typeof afterValue === "string"
    ) {
      changes.push({
        kind: "markdown",
        path: fieldPath,
        before: beforeValue,
        after: afterValue,
        lineParts: createMarkdownLineDiff(beforeValue, afterValue),
        inlineParts: createInlineTokenDiff(beforeValue, afterValue),
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

function compareTranslations(before: unknown, after: unknown) {
  const beforeByLanguage = new Map(
    (Array.isArray(before) ? before : []).map((item) => [
      String(asRecord(item).language ?? "unknown"),
      asRecord(item),
    ]),
  );
  const afterByLanguage = new Map(
    (Array.isArray(after) ? after : []).map((item) => [
      String(asRecord(item).language ?? "unknown"),
      asRecord(item),
    ]),
  );
  return [
    ...new Set([...beforeByLanguage.keys(), ...afterByLanguage.keys()]),
  ].flatMap((language) =>
    compareKnownRecord(
      `translations.${language}`,
      beforeByLanguage.get(language) ?? {},
      afterByLanguage.get(language) ?? {},
    ),
  );
}

function rawChange(
  path: string,
  before: unknown,
  after: unknown,
  allowRaw: boolean,
): HistoryFieldChange {
  return {
    kind: "raw",
    path,
    before: allowRaw ? before : undefined,
    after: allowRaw ? after : undefined,
    rawParts: allowRaw
      ? diffJson(before, after).map((part) => ({
          type: toPartType(part),
          value: part.value,
        }))
      : undefined,
    hidden: !allowRaw,
  };
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

    if (slot === "translations") {
      changes.push(...compareTranslations(before, after));
    } else if (
      ["tags", "subjects", "credits", "supportLanguages"].includes(slot)
    ) {
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
