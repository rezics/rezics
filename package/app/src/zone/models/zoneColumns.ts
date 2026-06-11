import type { ZoneColumn } from "@rezics/contract";

export function zoneColumnsGridTemplate(
  columns: readonly Pick<ZoneColumn, "ratio">[],
): string {
  return columns.map((column) => `minmax(0, ${column.ratio}fr)`).join(" ");
}
