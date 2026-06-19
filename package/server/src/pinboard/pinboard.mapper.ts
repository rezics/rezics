import type {
  PinboardAdminReadResponse,
  PinboardReadResponse,
} from "@rezics/contract";
import { Pinboard, PinboardEntry } from "../db/schema";

type PinboardRow = typeof Pinboard.$inferSelect;
type PinboardEntryRow = typeof PinboardEntry.$inferSelect;

export function mapPinboardReadResponse(input: {
  pinboard: PinboardRow;
  entries: PinboardEntryRow[];
}): PinboardReadResponse {
  return {
    realmId: input.pinboard.realmUnitId,
    placement: input.pinboard.placement,
    kind: "list",
    unitIds: input.entries.map((entry) => entry.unitId),
  };
}

export function mapPinboardAdminReadResponse(input: {
  pinboard: PinboardRow;
  entries: PinboardEntryRow[];
  staleIds: string[];
}): PinboardAdminReadResponse {
  return {
    realmId: input.pinboard.realmUnitId,
    placement: input.pinboard.placement,
    kind: "list",
    unitIds: input.entries.map((entry) => entry.unitId),
    staleIds: input.staleIds,
  };
}
