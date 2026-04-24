/**
 * React Query keys for the pinboard domain.
 */

import type { PinboardKey } from "@rezics/contract";

export interface PinboardListKeyInput {
  realmUnitId: string;
  pinboardKey: PinboardKey;
  language?: string;
  adminView?: boolean;
}

export interface PinboardDetailKeyInput {
  realmUnitId: string;
  pinboardKey: PinboardKey;
  unitId: string;
  language?: string;
}

export const pinboardKeys = {
  all: () => ["pinboard"] as const,

  boards: (realmUnitId: string) =>
    [...pinboardKeys.all(), "realm", realmUnitId] as const,

  board: (realmUnitId: string, pinboardKey: PinboardKey) =>
    [...pinboardKeys.boards(realmUnitId), pinboardKey] as const,

  list: (input: PinboardListKeyInput) =>
    [
      ...pinboardKeys.board(input.realmUnitId, input.pinboardKey),
      "list",
      { language: input.language, adminView: input.adminView ?? false },
    ] as const,

  detail: (input: PinboardDetailKeyInput) =>
    [
      ...pinboardKeys.board(input.realmUnitId, input.pinboardKey),
      "detail",
      input.unitId,
      { language: input.language },
    ] as const,
} as const;
