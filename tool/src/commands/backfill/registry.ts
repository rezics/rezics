import {
  parseZoneConfig,
  ZONE_CONFIG_SCHEMA,
} from "../../../../package/contract/src/zone";

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
    schemaName: ZONE_CONFIG_SCHEMA,
    table: "Zone",
    cursorColumn: "unitId",
    jsonColumn: "config",
    latestVersion: 1,
    upgrade: parseZoneConfig,
  },
] satisfies EnvelopeBackfillSpec[];

export function findEnvelopeBackfill(schemaName: string) {
  return envelopeBackfills.find((spec) => spec.schemaName === schemaName);
}
