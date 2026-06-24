import type { EditorialPatchSubmission } from "@rezics/contract";

export type RestoreEditSubmitState = {
  isRestoreMode: boolean;
  isLoading: boolean;
  hasError: boolean;
  hasContentPayload: boolean;
};

export type RestoreSourceParams = {
  enabled: boolean;
  bookId: string;
  restoreSequence: number;
  sourcePaths: readonly string[];
};

export function isRestoreEditSubmitDisabled(
  state: RestoreEditSubmitState,
): boolean {
  return (
    state.isRestoreMode &&
    (state.isLoading || state.hasError || !state.hasContentPayload)
  );
}

export function collectLeafPaths(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, nested]) => {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      const nestedPaths = collectLeafPaths(nested, nextPrefix);
      return nestedPaths.length > 0 ? nestedPaths : [nextPrefix];
    },
  );
}

export function withRestoreSource(
  input: EditorialPatchSubmission,
  params: RestoreSourceParams,
): EditorialPatchSubmission {
  if (!params.enabled || !Number.isFinite(params.restoreSequence)) return input;

  const submittedPaths = collectLeafPaths(input.patch);
  const restoredPaths = params.sourcePaths.filter((path) =>
    submittedPaths.includes(path),
  );
  if (restoredPaths.length === 0) return input;

  return {
    ...input,
    restoreSource: {
      kind: "revision",
      unitId: params.bookId,
      sequence: params.restoreSequence,
      paths: restoredPaths,
    },
  };
}
