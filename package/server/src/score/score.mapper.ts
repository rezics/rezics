import type {
  ScoreAggregateDTO,
  ScoreEntryDTO,
  ScoreRealmFieldDTO,
} from "@rezics/contract";
import type {
  ScoreAggregate,
  ScoreEntry,
  ScoreRealmField,
} from "#/prisma/client";
import type {
  Distribution,
  FieldAggregate,
  FieldsAggregate,
} from "./score.types";
import { SCORE_MAX, SCORE_MIN } from "./score.types";

// ============================================================
// DTO MAPPERS
// ============================================================

export function mapScoreEntryToDTO(entry: ScoreEntry): ScoreEntryDTO {
  return {
    id: entry.id,
    userId: entry.userId,
    unitId: entry.unitId,
    realm: entry.realm,
    value: entry.value,
    fields: entry.fields as Record<string, number> | null | undefined,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

export function mapScoreAggregateToDTO(agg: ScoreAggregate): ScoreAggregateDTO {
  return {
    unitId: agg.unitId,
    realm: agg.realm,
    totalScore: agg.totalScore,
    totalCount: agg.totalCount,
    distribution: agg.distribution as Distribution,
    fields: agg.fields as FieldsAggregate | null | undefined,
    updatedAt: agg.updatedAt.toISOString(),
  };
}

export function mapScoreRealmFieldToDTO(
  field: ScoreRealmField,
): ScoreRealmFieldDTO {
  return {
    realm: field.realm,
    key: field.key,
    label: field.label,
    sortOrder: field.sortOrder,
    createdAt: field.createdAt.toISOString(),
    updatedAt: field.updatedAt.toISOString(),
  };
}

// ============================================================
// VALIDATION
// ============================================================

export function validateScore(value: number): boolean {
  return Number.isInteger(value) && value >= SCORE_MIN && value <= SCORE_MAX;
}

export function validateFields(
  fields: Record<string, number>,
  allowedKeys: Set<string>,
): { valid: boolean; invalidKeys: string[] } {
  const invalidKeys: string[] = [];
  for (const [key, val] of Object.entries(fields)) {
    if (!allowedKeys.has(key)) {
      invalidKeys.push(key);
    } else if (!validateScore(val)) {
      invalidKeys.push(key);
    }
  }
  return { valid: invalidKeys.length === 0, invalidKeys };
}

// ============================================================
// AGGREGATE DELTA COMPUTATION
// ============================================================

export function emptyDistribution(): Distribution {
  return {};
}

export function applyDistributionDelta(
  dist: Distribution,
  oldValue: number | null,
  newValue: number | null,
): Distribution {
  const result = { ...dist };
  if (oldValue !== null) {
    const key = String(oldValue);
    result[key] = (result[key] ?? 0) - 1;
    if (result[key] <= 0) delete result[key];
  }
  if (newValue !== null) {
    const key = String(newValue);
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

export function applyFieldsDelta(
  currentFields: FieldsAggregate | null,
  oldEntryFields: Record<string, number> | null,
  newEntryFields: Record<string, number> | null,
): FieldsAggregate | null {
  const result: FieldsAggregate = currentFields ? { ...currentFields } : {};

  const allKeys = new Set<string>([
    ...Object.keys(oldEntryFields ?? {}),
    ...Object.keys(newEntryFields ?? {}),
  ]);

  if (allKeys.size === 0) return currentFields;

  for (const key of allKeys) {
    const oldVal = oldEntryFields?.[key] ?? null;
    const newVal = newEntryFields?.[key] ?? null;

    if (oldVal === null && newVal === null) continue;

    const current: FieldAggregate = result[key]
      ? { ...result[key], dist: { ...result[key].dist } }
      : { total: 0, count: 0, dist: {} };

    if (oldVal !== null) {
      current.total -= oldVal;
      current.count -= 1;
      const distKey = String(oldVal);
      current.dist[distKey] = (current.dist[distKey] ?? 0) - 1;
      if (current.dist[distKey] <= 0) delete current.dist[distKey];
    }

    if (newVal !== null) {
      current.total += newVal;
      current.count += 1;
      const distKey = String(newVal);
      current.dist[distKey] = (current.dist[distKey] ?? 0) + 1;
    }

    if (current.count <= 0) {
      delete result[key];
    } else {
      result[key] = current;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

export function computeAggregateFromEntries(entries: ScoreEntry[]): {
  totalScore: number;
  totalCount: number;
  distribution: Distribution;
  fields: FieldsAggregate | null;
} {
  let totalScore = 0;
  const totalCount = entries.length;
  const distribution: Distribution = {};
  const fields: FieldsAggregate = {};

  for (const entry of entries) {
    totalScore += entry.value;
    const distKey = String(entry.value);
    distribution[distKey] = (distribution[distKey] ?? 0) + 1;

    const entryFields = entry.fields as Record<string, number> | null;
    if (entryFields) {
      for (const [key, val] of Object.entries(entryFields)) {
        if (!fields[key]) {
          fields[key] = { total: 0, count: 0, dist: {} };
        }
        fields[key].total += val;
        fields[key].count += 1;
        const fDistKey = String(val);
        fields[key].dist[fDistKey] = (fields[key].dist[fDistKey] ?? 0) + 1;
      }
    }
  }

  return {
    totalScore,
    totalCount,
    distribution,
    fields: Object.keys(fields).length > 0 ? fields : null,
  };
}
