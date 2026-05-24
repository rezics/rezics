import type {
  UserUnitProgressStatus as ContractProgressStatus,
  UnitProgressListQuery,
  UnitProgressUpsertBody,
} from "@rezics/contract";
import { UserUnitProgressStatus } from "#/prisma/client";

export const progressStatusMap = {
  BACKLOG: UserUnitProgressStatus.BACKLOG,
  ACTIVE: UserUnitProgressStatus.ACTIVE,
  PAUSED: UserUnitProgressStatus.PAUSED,
  COMPLETED: UserUnitProgressStatus.COMPLETED,
  DROPPED: UserUnitProgressStatus.DROPPED,
} satisfies Record<ContractProgressStatus, UserUnitProgressStatus>;

export type ProgressUpsertInput = UnitProgressUpsertBody;
export type ProgressListInput = UnitProgressListQuery;

export type ProgressCursor = {
  lastSeenAt: string;
  unitId: string;
};
