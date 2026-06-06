import {
  EXPECTED_MEILI_INDEX_SCHEMAS,
  type ExpectedMeiliIndexSchema,
  type ExpectedMeiliIndexUid,
} from "@rezics/search";
import type {
  AttributeDrift,
  MeiliIndexStatus,
  MeiliStatusSummary,
  MeiliTaskSummary,
  SettingsDrift,
  StatusState,
} from "@/diagnostic/status.types";
import { searchClient } from "./search-client";

const DEFAULT_TIMEOUT_MS = 2_500;
const RECENT_TASK_LIMIT = 25;

type RawMeiliClient = Record<string, any>;

function timeout<T>(promise: Promise<T>, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(
        () => reject(new Error("Timed out while checking Meili")),
        timeoutMs,
      );
    }),
  ]);
}

function safeReason(error: unknown): string {
  if (!(error instanceof Error)) return "Meilisearch check failed";
  if (/timed out/i.test(error.message)) return error.message;
  const code = (error as { code?: string; cause?: { code?: string } }).code;
  const causeCode = (error as { cause?: { code?: string } }).cause?.code;
  if (code || causeCode) return `Meilisearch returned ${code ?? causeCode}`;
  return "Meilisearch check failed";
}

function normalizeArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function compareAttributes(
  expected: readonly string[],
  actualValue: unknown,
): AttributeDrift {
  const actual = normalizeArray(actualValue);
  return {
    expected: [...expected],
    actual,
    missing: expected.filter((item) => !actual.includes(item)),
    extra: actual.filter((item) => !expected.includes(item)),
  };
}

export function compareMeiliSettings(
  expected: ExpectedMeiliIndexSchema,
  live: Record<string, unknown> | null | undefined,
  livePrimaryKey?: string | null,
): SettingsDrift {
  const searchableAttributes = compareAttributes(
    expected.searchableAttributes,
    live?.searchableAttributes,
  );
  const filterableAttributes = compareAttributes(
    expected.filterableAttributes,
    live?.filterableAttributes,
  );
  const sortableAttributes = compareAttributes(
    expected.sortableAttributes,
    live?.sortableAttributes,
  );
  const primaryKeyMatches = livePrimaryKey === expected.primaryKey;

  return {
    primaryKey: {
      expected: expected.primaryKey,
      actual: livePrimaryKey ?? null,
      matches: primaryKeyMatches,
    },
    searchableAttributes,
    filterableAttributes,
    sortableAttributes,
    hasDrift:
      !primaryKeyMatches ||
      searchableAttributes.missing.length > 0 ||
      searchableAttributes.extra.length > 0 ||
      filterableAttributes.missing.length > 0 ||
      filterableAttributes.extra.length > 0 ||
      sortableAttributes.missing.length > 0 ||
      sortableAttributes.extra.length > 0,
  };
}

function hasDrift(drift: SettingsDrift | undefined) {
  return drift?.hasDrift ?? false;
}

function normalizeIndexes(indexes: unknown): Array<Record<string, any>> {
  if (Array.isArray(indexes)) return indexes as Array<Record<string, any>>;
  const results = (indexes as { results?: unknown })?.results;
  return Array.isArray(results) ? (results as Array<Record<string, any>>) : [];
}

function normalizeTasks(tasks: unknown): MeiliTaskSummary[] {
  const results = Array.isArray(tasks)
    ? tasks
    : ((tasks as { results?: unknown })?.results ?? []);
  if (!Array.isArray(results)) return [];

  return results
    .slice(0, RECENT_TASK_LIMIT)
    .map((task: Record<string, any>) => ({
      uid: task.uid ?? task.taskUid ?? "unknown",
      indexUid: task.indexUid ?? null,
      status: task.status ?? null,
      type: task.type ?? null,
      duration: task.duration ?? null,
      enqueuedAt: task.enqueuedAt ?? null,
      startedAt: task.startedAt ?? null,
      finishedAt: task.finishedAt ?? null,
      errorCode: task.error?.code ?? null,
      errorMessage: task.error?.message ?? null,
    }));
}

function statusFromParts(parts: Array<StatusState | undefined>): StatusState {
  if (parts.includes("unavailable")) return "unavailable";
  if (parts.includes("degraded")) return "degraded";
  if (parts.every((part) => part === "available")) return "available";
  return "unknown";
}

function summaryFields(
  schema: ExpectedMeiliIndexSchema,
  fieldDistribution: Record<string, number> | undefined,
) {
  if (!schema.facetableSummaryFields?.length) return undefined;
  return Object.fromEntries(
    schema.facetableSummaryFields.map((field) => [
      field,
      fieldDistribution?.[field] ?? null,
    ]),
  );
}

async function loadIndexStatus(
  meili: RawMeiliClient,
  schema: ExpectedMeiliIndexSchema,
  liveIndex: Record<string, any> | undefined,
  stats: Record<string, any> | undefined,
  timeoutMs: number,
): Promise<MeiliIndexStatus> {
  if (!liveIndex) {
    return {
      uid: schema.uid,
      label: schema.domain,
      status: "degraded",
      exists: false,
      expected: schema,
      reason: "Expected index is missing",
    };
  }

  try {
    const index = meili.index(schema.uid);
    const [settings, indexInfo] = await Promise.all([
      timeout(Promise.resolve(index.getSettings()), timeoutMs),
      timeout(Promise.resolve(index.getRawInfo?.() ?? liveIndex), timeoutMs),
    ]);
    const primaryKey =
      (indexInfo as { primaryKey?: string | null })?.primaryKey ??
      liveIndex.primaryKey ??
      null;
    const drift = compareMeiliSettings(schema, settings, primaryKey);
    const indexStats = stats?.indexes?.[schema.uid] ?? {};
    const fieldDistribution = indexStats.fieldDistribution as
      | Record<string, number>
      | undefined;

    return {
      uid: schema.uid,
      label: schema.domain,
      status: hasDrift(drift) ? "degraded" : "available",
      exists: true,
      expected: schema,
      primaryKey,
      numberOfDocuments: indexStats.numberOfDocuments,
      isIndexing: indexStats.isIndexing,
      lastUpdate: indexStats.lastUpdate ?? null,
      databaseSize: indexStats.rawDocumentDbSize,
      averageDocumentSize: indexStats.avgDocumentSize,
      fieldDistribution,
      summaryFields: summaryFields(schema, fieldDistribution),
      settingsDrift: drift,
      reason: hasDrift(drift)
        ? "Live settings differ from expected schema"
        : undefined,
    };
  } catch (error) {
    return {
      uid: schema.uid,
      label: schema.domain,
      status: "unknown",
      exists: true,
      expected: schema,
      reason: safeReason(error),
    };
  }
}

export async function getMeiliStatusSummary(options?: {
  meili?: RawMeiliClient;
  timeoutMs?: number;
}): Promise<MeiliStatusSummary> {
  const meili = options?.meili ?? (searchClient.meili as RawMeiliClient);
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const checkedAt = new Date().toISOString();

  try {
    const [health, version, stats, indexes, tasks] = await Promise.all([
      timeout(Promise.resolve(meili.health()), timeoutMs),
      timeout(Promise.resolve(meili.getVersion?.()), timeoutMs).catch(
        () => null,
      ),
      timeout(Promise.resolve(meili.getStats?.()), timeoutMs).catch(() => null),
      timeout(Promise.resolve(meili.getIndexes?.({ limit: 1_000 })), timeoutMs),
      timeout(
        Promise.resolve(meili.getTasks?.({ limit: RECENT_TASK_LIMIT })),
        timeoutMs,
      ).catch(() => ({ results: [] })),
    ]);

    if ((health as { status?: string })?.status !== "available") {
      return {
        status: "unavailable",
        checkedAt,
        reason: "Meilisearch health endpoint is not available",
        schemas: [...EXPECTED_MEILI_INDEX_SCHEMAS],
        indexes: [],
        tasks: normalizeTasks(tasks),
      };
    }

    const liveIndexes = normalizeIndexes(indexes);
    const liveByUid = new Map(liveIndexes.map((index) => [index.uid, index]));
    const indexStatuses = await Promise.all(
      EXPECTED_MEILI_INDEX_SCHEMAS.map((schema) =>
        loadIndexStatus(
          meili,
          schema,
          liveByUid.get(schema.uid),
          stats as Record<string, any> | undefined,
          timeoutMs,
        ),
      ),
    );
    const taskSummaries = normalizeTasks(tasks);
    const hasFailedTask = taskSummaries.some(
      (task) => task.status === "failed",
    );

    return {
      status: statusFromParts([
        ...indexStatuses.map((index) => index.status),
        hasFailedTask ? "degraded" : "available",
      ]),
      checkedAt,
      version: (version as { pkgVersion?: string })?.pkgVersion,
      schemas: [...EXPECTED_MEILI_INDEX_SCHEMAS],
      indexes: indexStatuses,
      tasks: taskSummaries,
      reason: hasFailedTask ? "Recent Meili task failure detected" : undefined,
    };
  } catch (error) {
    return {
      status: "unavailable",
      checkedAt,
      reason: safeReason(error),
      schemas: [...EXPECTED_MEILI_INDEX_SCHEMAS],
      indexes: [],
      tasks: [],
    };
  }
}
