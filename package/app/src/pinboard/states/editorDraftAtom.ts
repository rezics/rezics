/**
 * Jotai atoms for the pinboard editor draft.
 *
 * One draft per `(realmUnitId, pinboardKey, unitId?)` tuple so opening the
 * editor for a different entry doesn't clobber unsaved changes. The family
 * is keyed by a serialized string so each tuple maps to a stable atom.
 */

import { atom } from "jotai";
import { atomFamily } from "jotai-family";
import type { PinboardEditorDraft, PinboardKey } from "../models/types";

export interface EditorDraftKey {
  realmUnitId: string;
  pinboardKey: PinboardKey;
  unitId: string | null;
}

export function serializeEditorDraftKey(key: EditorDraftKey): string {
  return `${key.realmUnitId}:${key.pinboardKey}:${key.unitId ?? "__new__"}`;
}

export const editorDraftAtomFamily = atomFamily((_serialized: string) =>
  atom<PinboardEditorDraft | null>(null),
);
