import type { UnitDTO } from "@rezics/contract";

export function buildUnitUrl(unit: UnitDTO): string {
  switch (unit.type) {
    case "BOOK":
      return `/book/${unit.id}`;
    case "POST":
      return `/review/${unit.id}`;
    case "QUOTE":
      return `/excerpt/${unit.id}`;
    case "SHELF":
      return `/shelf/${unit.id}`;
    case "TAG":
      return `/tag/${unit.id}`;
    case "REALM":
      return `/realm/${unit.id}`;
    default:
      return `/unit/${unit.id}`;
  }
}
