/**
 * Pinboard view-model types.
 *
 * Pure types only — no React imports. Re-exports contract DTOs and
 * defines the editor draft shape used by the admin dialog + Jotai atom.
 */

import type {
  CreatePinboardEntryBody,
  PinBody,
  PinboardEntryDTO,
  PinboardEntryDetailDTO,
  PinboardKey,
  PinboardListResponse,
  PinboardTranslationInput,
  ReorderBody,
  UpdatePinboardEntryBody,
} from "@rezics/contract";

export type {
  CreatePinboardEntryBody,
  PinBody,
  PinboardEntryDTO,
  PinboardEntryDetailDTO,
  PinboardKey,
  PinboardListResponse,
  PinboardTranslationInput,
  ReorderBody,
  UpdatePinboardEntryBody,
};

/**
 * One editor form slice for a single language.
 */
export interface PinboardEditorTranslationDraft {
  language: string;
  title: string;
  subtitle: string;
  summary: string;
  description: string;
  body: string;
}

/**
 * Full editor draft state. Tracks dirty + which translations are
 * currently loaded versus queued for removal.
 */
export interface PinboardEditorDraft {
  unitId: string | null;
  pinboardKey: PinboardKey;
  realmUnitId: string;
  defaultLanguage: string;
  translations: PinboardEditorTranslationDraft[];
  removedLanguages: string[];
  dirty: boolean;
}
