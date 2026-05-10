import type { UserUnitProgressStatus } from "@rezics/contract";

export type ReadStatus = UserUnitProgressStatus;

export const READ_STATUS_VALUES = [
  "BACKLOG",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "DROPPED",
] as const satisfies readonly ReadStatus[];

export type StatusLabelMap = Record<ReadStatus, string>;

export const READ_STATUS_LABELS_ZH_HANT: StatusLabelMap = {
  BACKLOG: "想讀",
  ACTIVE: "在讀",
  PAUSED: "擱置",
  COMPLETED: "已讀",
  DROPPED: "棄",
};

export const READ_STATUS_LABELS_EN: StatusLabelMap = {
  BACKLOG: "Want to read",
  ACTIVE: "Reading",
  PAUSED: "Paused",
  COMPLETED: "Read",
  DROPPED: "Dropped",
};

export const READ_STATUS_I18N_KEYS = {
  BACKLOG: "book.hero.actions.want_to_read",
  ACTIVE: "book.hero.actions.reading",
  PAUSED: "book.hero.actions.paused",
  COMPLETED: "book.hero.actions.read",
  DROPPED: "book.hero.actions.dropped",
} as const satisfies Record<ReadStatus, string>;

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
