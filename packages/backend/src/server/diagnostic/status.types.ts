import type {
  MeiliIndexStatus as ContractMeiliIndexStatus,
  MeiliStatusSummary as ContractMeiliStatusSummary,
  SystemStatusSummary as ContractSystemStatusSummary,
} from "@rezics/contract";
import type {
  ExpectedMeiliIndexSchema,
  ExpectedMeiliIndexUid,
} from "../../search/schema";

export type {
  AttributeDrift,
  CdcDetectedIssue,
  CdcIssueCode,
  CdcSourceStatus,
  CdcStatus,
  FailedJobSummary,
  HistoryOutboxFailedSummary,
  HistoryOutboxPendingSummary,
  HistoryOutboxStatus,
  MeiliTaskSummary,
  QueueStateCounts,
  QueueStatus,
  SettingsDrift,
  StatusItem,
  StatusLink,
  StatusState,
} from "@rezics/contract";

export type MeiliIndexStatus = Omit<
  ContractMeiliIndexStatus,
  "expected" | "uid"
> & {
  uid: ExpectedMeiliIndexUid;
  expected: ExpectedMeiliIndexSchema;
};

export type MeiliStatusSummary = Omit<
  ContractMeiliStatusSummary,
  "indexes" | "schemas"
> & {
  schemas: ExpectedMeiliIndexSchema[];
  indexes: MeiliIndexStatus[];
};

export type SystemStatusSummary = Omit<ContractSystemStatusSummary, "meili"> & {
  meili: MeiliStatusSummary;
};
