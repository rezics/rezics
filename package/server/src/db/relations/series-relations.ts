import type { ServerRelationsBuilder } from "./types";

export function seriesRelations(r: ServerRelationsBuilder) {
  return {
    Series: {
      Unit: r.one.Unit({
        from: r.Series.unitId,
        to: r.Unit.id,
      }),
      SeriesContentIndices: r.many.SeriesContentIndex(),
    },
    SeriesContentIndex: {
      ContentStructureNode: r.one.ContentStructureNode({
        from: r.SeriesContentIndex.contentNodeId,
        to: r.ContentStructureNode.id,
      }),
      Unit: r.one.Unit({
        from: r.SeriesContentIndex.releaseUnitId,
        to: r.Unit.id,
      }),
      Series: r.one.Series({
        from: r.SeriesContentIndex.seriesUnitId,
        to: r.Series.unitId,
      }),
    },
  };
}
