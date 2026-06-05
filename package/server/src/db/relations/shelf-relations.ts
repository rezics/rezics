import type { ServerRelationsBuilder } from "./types";

export function shelfRelations(r: ServerRelationsBuilder) {
  return {
    Shelf: {
      Unit: r.one.Unit({
        from: r.Shelf.unitId,
        to: r.Unit.id,
      }),
      ShelfUnits: r.many.ShelfUnit(),
      ShelfUnitRelations: r.many.ShelfUnitRelation(),
    },
    ShelfUnit: {
      Shelf: r.one.Shelf({
        from: r.ShelfUnit.shelfId,
        to: r.Shelf.unitId,
      }),
      ShelfUnitRelations_shelfId_childUnitId: r.many.ShelfUnitRelation({
        alias: "ShelfUnitRelation_shelfId_childUnitId_ShelfUnit_shelfId_unitId",
      }),
      ShelfUnitRelations_shelfId_parentUnitId: r.many.ShelfUnitRelation({
        alias:
          "ShelfUnitRelation_shelfId_parentUnitId_ShelfUnit_shelfId_unitId",
      }),
    },
    ShelfUnitRelation: {
      ShelfUnit_shelfId_childUnitId: r.one.ShelfUnit({
        from: [r.ShelfUnitRelation.shelfId, r.ShelfUnitRelation.childUnitId],
        to: [r.ShelfUnit.shelfId, r.ShelfUnit.unitId],
        alias: "ShelfUnitRelation_shelfId_childUnitId_ShelfUnit_shelfId_unitId",
      }),
      Shelf: r.one.Shelf({
        from: r.ShelfUnitRelation.shelfId,
        to: r.Shelf.unitId,
      }),
      ShelfUnit_shelfId_parentUnitId: r.one.ShelfUnit({
        from: [r.ShelfUnitRelation.shelfId, r.ShelfUnitRelation.parentUnitId],
        to: [r.ShelfUnit.shelfId, r.ShelfUnit.unitId],
        alias:
          "ShelfUnitRelation_shelfId_parentUnitId_ShelfUnit_shelfId_unitId",
      }),
    },
  };
}
