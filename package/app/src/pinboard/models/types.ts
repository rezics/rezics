/**
 * Pinboard view-model types.
 *
 * Pure types only — no React imports. A first-class Pinboard is the source of
 * truth, and per-Unit titles/summaries are resolved at read time from the
 * Unit's translations.
 */

import type { RealmPinboardPlacement } from "@rezics/contract";

/**
 * Pinboard placement this feature renders. The current product surface manages only
 * the realm home Pinboard; homepage notices are presentation, not a data placement.
 */
export type PinboardListPlacement = RealmPinboardPlacement;

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
