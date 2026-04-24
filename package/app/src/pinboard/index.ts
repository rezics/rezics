/**
 * Public surface of the pinboard feature.
 *
 * Consumers SHALL import from this file only. `models/`, `hooks/`,
 * `states/`, and internal `components/` are considered private.
 */

export { PinboardEntryCard } from "./components/PinboardEntryCard";
export type {
  PinboardEntryCardProps,
  PinboardEntryCardVariant,
} from "./components/PinboardEntryCard";

export { AnnouncementFeedSection } from "./sections/AnnouncementFeedSection";
export type {
  AnnouncementFeedSectionProps,
  PinboardAnnouncementItem,
} from "./sections/AnnouncementFeedSection";

export { PinboardAdminSection } from "./sections/PinboardAdminSection";
export type { PinboardAdminSectionProps } from "./sections/PinboardAdminSection";

export { PinnedFeedSection } from "./sections/PinnedFeedSection";
export type { PinnedFeedSectionProps } from "./sections/PinnedFeedSection";
