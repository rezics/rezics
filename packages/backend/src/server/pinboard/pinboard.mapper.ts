import type {
  PinboardKey,
  PinboardAdminReadResponse,
  PinboardReadResponse,
} from "@rezics/contract";
import { pinboardHomeKey } from "@rezics/contract";
import { Pinboard, PinboardEntry } from "../db/schema";

type PinboardRow = typeof Pinboard.$inferSelect;
type PinboardEntryRow = typeof PinboardEntry.$inferSelect;

function mapPinboardKey(key: string): PinboardKey {
  if (key !== pinboardHomeKey) {
    throw new Error(`Unsupported pinboard key: ${key}`);
  }
  return key;
}

export function mapPinboardReadResponse(input: {
  pinboard: PinboardRow;
  entries: PinboardEntryRow[];
}): PinboardReadResponse {
  return {
    realmId: input.pinboard.realmUnitId,
    key: mapPinboardKey(input.pinboard.key),
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
    key: mapPinboardKey(input.pinboard.key),
    kind: "list",
    unitIds: input.entries.map((entry) => entry.unitId),
    staleIds: input.staleIds,
  };
}
