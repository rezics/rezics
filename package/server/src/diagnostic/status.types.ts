import type {
  ExpectedMeiliIndexSchema,
  ExpectedMeiliIndexUid,
} from "@rezics/search";

export type StatusState = "available" | "degraded" | "unavailable" | "unknown";

export interface StatusItem {
  id: string;
  label: string;
  status: StatusState;
  reason?: string;
  url?: string;
  checkedAt?: string;
  remediation?: string;
}

export interface StatusLink {
  id: string;
  label: string;
  status: StatusState;
  url?: string;
  reason?: string;
}

export interface SettingsDrift {
  primaryKey?: {
    expected: string;
    actual: string | null;
    matches: boolean;
  };
  searchableAttributes: AttributeDrift;
  filterableAttributes: AttributeDrift;
  sortableAttributes: AttributeDrift;
  hasDrift: boolean;
}

export interface AttributeDrift {
  expected: string[];
  actual: string[];
  missing: string[];
  extra: string[];
}

export interface MeiliIndexStatus {
  uid: ExpectedMeiliIndexUid;
  label: string;
  status: StatusState;
  exists: boolean;
  expected: ExpectedMeiliIndexSchema;
  primaryKey?: string | null;
  numberOfDocuments?: number;
  isIndexing?: boolean;
  lastUpdate?: string | null;
  databaseSize?: number;
  averageDocumentSize?: number;
  fieldDistribution?: Record<string, number>;
  summaryFields?: Record<string, number | null>;
  settingsDrift?: SettingsDrift;
  reason?: string;
}

export interface MeiliTaskSummary {
  uid: number | string;
  indexUid?: string | null;
  status?: string | null;
  type?: string | null;
  duration?: string | null;
  enqueuedAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface MeiliStatusSummary {
  status: StatusState;
  checkedAt: string;
  version?: string;
  reason?: string;
  schemas: ExpectedMeiliIndexSchema[];
  indexes: MeiliIndexStatus[];
  tasks: MeiliTaskSummary[];
}

export interface QueueStateCounts {
  lane: string;
  created: number;
  retry: number;
  active: number;
  completed: number;
  cancelled: number;
  failed: number;
  all: number;
}

export interface FailedJobSummary {
  id: string | null;
  lane: string | null;
  state: string | null;
  commandKind: string | null;
  commandLane: string | null;
  attemptCount: number;
  createdAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  source?: unknown;
}

export interface QueueStatus {
  item: StatusItem;
  counts: QueueStateCounts[];
  failedJobs: FailedJobSummary[];
}

export interface CdcStatus {
  item: StatusItem;
  walLevel?: string | null;
  publicationName?: string | null;
  publicationExists?: boolean;
  routedTables: string[];
  publicationTables: string[];
  missingTables: string[];
  slotName?: string | null;
  slotExists?: boolean;
  slotActive?: boolean | null;
  confirmedFlushLsn?: string | null;
  lagBytes?: number | null;
}

export interface SystemStatusSummary {
  status: StatusState;
  checkedAt: string;
  services: StatusItem[];
  links: StatusLink[];
  databases: StatusItem[];
  cdc: CdcStatus;
  queue: QueueStatus;
  meili: MeiliStatusSummary;
  sequin: StatusItem;
}
