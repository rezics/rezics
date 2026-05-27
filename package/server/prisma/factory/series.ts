import type { SeriesKind } from "@rezics/contract";

export interface FactorySeriesVerificationInput {
  seriesUnitId: string;
  kindKey: SeriesKind;
  representativeReleaseUnitId: string;
  workUnitId: string;
  contentNodeId: string;
}

export function buildFactorySeriesVerificationPlan(
  input: FactorySeriesVerificationInput,
) {
  return {
    seriesExtension: {
      unitId: input.seriesUnitId,
      kindKey: input.kindKey,
    },
    directReleaseNode: {
      ownerUnitId: input.seriesUnitId,
      contentUnitId: input.representativeReleaseUnitId,
      id: input.contentNodeId,
    },
    directIndexRow: {
      seriesUnitId: input.seriesUnitId,
      releaseUnitId: input.representativeReleaseUnitId,
      contentNodeId: input.contentNodeId,
    },
    representativeRelease: {
      releaseUnitId: input.representativeReleaseUnitId,
      workUnitId: input.workUnitId,
    },
    workProjection: {
      unitId: input.seriesUnitId,
      workUnitId: input.workUnitId,
      role: "SERIES" as const,
    },
  };
}
