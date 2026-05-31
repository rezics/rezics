import type { SeriesKind } from "@rezics/contract";

export interface FactorySeriesVerificationInput {
  seriesUnitId: string;
  kindKey: SeriesKind;
  releaseUnitId: string;
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
      contentUnitId: input.releaseUnitId,
      id: input.contentNodeId,
    },
    directIndexRow: {
      seriesUnitId: input.seriesUnitId,
      releaseUnitId: input.releaseUnitId,
      contentNodeId: input.contentNodeId,
    },
  };
}
