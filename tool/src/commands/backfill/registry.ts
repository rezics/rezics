import {
  parseZoneBoundary,
  parseZoneNav,
  parseZoneTheme,
  ZONE_BOUNDARY_SCHEMA,
  ZONE_NAV_SCHEMA,
  ZONE_THEME_SCHEMA,
} from "../../../../package/contract/src/zone";
import { PAGE_SCHEMA, parsePage } from "../../../../package/contract/src/pages";

export type EnvelopeBackfillSpec = {
  schemaName: string;
  table: string;
  cursorColumn: string;
  jsonColumn: string;
  latestVersion: number;
  upgrade(value: unknown): unknown | null;
};

export const envelopeBackfills = [
  {
    schemaName: ZONE_BOUNDARY_SCHEMA,
    table: "Zone",
    cursorColumn: "unitId",
    jsonColumn: "boundary",
    latestVersion: 1,
    upgrade: parseZoneBoundary,
  },
  {
    schemaName: ZONE_NAV_SCHEMA,
    table: "Zone",
    cursorColumn: "unitId",
    jsonColumn: "nav",
    latestVersion: 1,
    upgrade: parseZoneNav,
  },
  {
    schemaName: ZONE_THEME_SCHEMA,
    table: "Zone",
    cursorColumn: "unitId",
    jsonColumn: "theme",
    latestVersion: 1,
    upgrade: parseZoneTheme,
  },
  {
    schemaName: PAGE_SCHEMA,
    table: "ZonePage",
    cursorColumn: "id",
    jsonColumn: "config",
    latestVersion: 1,
    upgrade: parsePage,
  },
] satisfies EnvelopeBackfillSpec[];

export function findEnvelopeBackfill(schemaName: string) {
  return envelopeBackfills.find((spec) => spec.schemaName === schemaName);
}
