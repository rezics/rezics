/**
 * Pinboard view-model types.
 *
 * Pure types only — no React imports. Phase G aligns this module with the
 * new contract: a Realm.extra ordered list of Unit IDs is the source of
 * truth, and per-Unit titles/summaries are resolved at read time from the
 * Unit's translations.
 */

import type { RealmExtraListKey } from "@rezics/contract";

/**
 * Well-known Realm.extra list keys this feature renders. Mirrored in the
 * contract's `RealmExtraListKey` so downstream switches stay exhaustive.
 */
export type PinboardListKey = RealmExtraListKey;

/**
 * Resolved entry passed to the presentation layer. Derived at read time from
 * the underlying Unit + its active translation.
 */
export interface PinboardEntryView {
  unitId: string;
  language: string;
  title?: string;
  subtitle?: string;
  summary?: string;
  description?: string;
  body?: string;
  imageUrl?: string;
  defaultLanguage?: string;
  updatedAt?: string;
  createdAt?: string;
}
