import { UnitType } from "../unit/unit";
import type { PageSectionKind } from "../pages/sections";
import type { DockWidgetKind } from "./widgets";

export const componentSurfaceValues = ["page", "dock"] as const;
export type ComponentSurface = (typeof componentSurfaceValues)[number];

export type SchemaComponentInfo = {
  surfaces: readonly ComponentSurface[];
  supportUnitTypes?: readonly UnitType[];
  refFields?: readonly string[];
  queryBehavior?: "none" | "staticRefs" | "lazyQuery" | "stream";
};

/**
 * Component registry describes static shape and capabilities only. Host policy
 * decides what a placement actually allows, locks, or requires.
 */
export const schemaComponentInfo = {
  richText: {
    surfaces: ["page", "dock"],
    supportUnitTypes: [
      UnitType.BOOK,
      UnitType.GAME,
      UnitType.MEDIA,
      UnitType.REALM,
      UnitType.ZONE,
    ],
    refFields: ["contentUnitId"],
    queryBehavior: "staticRefs",
  },
  query: {
    surfaces: ["page", "dock"],
    queryBehavior: "lazyQuery",
  },
  stream: {
    surfaces: ["page", "dock"],
    queryBehavior: "stream",
  },
  unitDescription: {
    surfaces: ["dock"],
    queryBehavior: "none",
  },
  zoneNav: {
    surfaces: ["dock"],
    refFields: ["zoneUnitId"],
  },
  pinboard: {
    surfaces: ["dock"],
    refFields: ["placement"],
  },
} as const satisfies Partial<
  Record<PageSectionKind | DockWidgetKind, SchemaComponentInfo>
>;
