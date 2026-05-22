import type { UserUnitProgressStatus } from "@rezics/contract";
import * as m from "@rezics/i18n/messages";

export type ReadStatus = UserUnitProgressStatus;

export const READ_STATUS_VALUES = [
  "BACKLOG",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "DROPPED",
] as const satisfies readonly ReadStatus[];

const READ_STATUS_MESSAGE = {
  BACKLOG: m.book_hero_actions_want_to_read,
  ACTIVE: m.book_hero_actions_reading,
  PAUSED: m.book_hero_actions_paused,
  COMPLETED: m.book_hero_actions_read,
  DROPPED: m.book_hero_actions_dropped,
} as const satisfies Record<ReadStatus, () => string>;

export function readStatusLabel(status: ReadStatus): string {
  return READ_STATUS_MESSAGE[status]();
}

export const TOGGLE_GROUP_STATUSES = [
  "BACKLOG",
  "ACTIVE",
  "COMPLETED",
] as const satisfies readonly ReadStatus[];

export type ToggleGroupStatus = (typeof TOGGLE_GROUP_STATUSES)[number];

export function isToggleGroupStatus(
  status: ReadStatus,
): status is ToggleGroupStatus {
  return (TOGGLE_GROUP_STATUSES as readonly ReadStatus[]).includes(status);
}
