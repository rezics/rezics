import type {
  UserUnitProgressStatus as ContractProgressStatus,
  UnitProgressListQuery,
  UnitProgressUpsertBody,
} from "@rezics/contract";

export const progressStatusMap = {
  BACKLOG: "BACKLOG",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  COMPLETED: "COMPLETED",
  DROPPED: "DROPPED",
} as const satisfies Record<ContractProgressStatus, string>;

export type ProgressUpsertInput = UnitProgressUpsertBody;
export type ProgressListInput = UnitProgressListQuery;

export type ProgressCursor = {
  lastSeenAt: string;
  unitId: string;
};
