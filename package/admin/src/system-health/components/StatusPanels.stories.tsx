import type {
  CdcStatus,
  HistoryOutboxStatus,
  QueueStatus,
  StatusItem,
} from "@rezics/api";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CdcPanel } from "./StatusPanels";

function item(
  id: string,
  label: string,
  status: StatusItem["status"],
  reason?: string,
): StatusItem {
  return {
    id,
    label,
    status,
    reason,
    checkedAt: "2026-06-05T00:00:00.000Z",
  };
}

const healthyCdc: CdcStatus = {
  item: item("cdc", "來源資料庫 CDC", "available"),
  walLevel: "logical",
  publicationName: "sequin_pub",
  publicationExists: true,
  routedTables: ["HistoryOutbox", "Unit", "Post"],
  publicationTables: ["HistoryOutbox", "Unit", "Post"],
  missingTables: [],
  extraTables: [],
  slotName: "sequin_slot",
  slotExists: true,
  slotActive: true,
  slotActivePid: 2401,
  restartLsn: "0/16B6C50",
  confirmedFlushLsn: "0/16B6CA0",
  maxReplicationSlots: 10,
  usedReplicationSlots: 1,
  availableReplicationSlots: 9,
  maxWalSenders: 10,
  activeWalSenders: 1,
  availableWalSenders: 9,
  lagBytes: 0,
};

const healthyHistoryOutbox: HistoryOutboxStatus = {
  item: item("history-outbox", "HistoryOutbox", "available"),
  counts: { pending: 0, failed: 0, processing: 0, completed: 128 },
  pending: 0,
  failed: 0,
  processing: 0,
  completed: 128,
  retryReady: 0,
  pendingWithoutIngestJob: false,
  recentPending: [],
  recentFailed: [],
  retryReadyFailed: [],
};

const healthyQueue: QueueStatus = {
  item: item("job-runner", "job-runner", "available"),
  counts: [
    {
      lane: "history.ingest",
      created: 0,
      retry: 0,
      active: 1,
      completed: 128,
      cancelled: 0,
      failed: 0,
      all: 129,
    },
  ],
  failedJobs: [],
};

const degradedCdc: CdcStatus = {
  ...healthyCdc,
  item: item(
    "cdc",
    "來源資料庫 CDC",
    "degraded",
    "publication 缺少已路由資料表，replication slot inactive",
  ),
  publicationTables: ["Unit", "Post"],
  missingTables: ["HistoryOutbox"],
  slotActive: false,
  slotActivePid: null,
  lagBytes: 422_144,
  availableWalSenders: 0,
};

const degradedHistoryOutbox: HistoryOutboxStatus = {
  ...healthyHistoryOutbox,
  item: item(
    "history-outbox",
    "HistoryOutbox",
    "degraded",
    "pending rows exist without history.ingest queue activity",
  ),
  counts: { pending: 12, failed: 2, processing: 0, completed: 128 },
  pending: 12,
  failed: 2,
  retryReady: 2,
  pendingWithoutIngestJob: true,
  recentPending: [
    {
      id: "outbox-1",
      unitId: "unit-1",
      sequence: "12",
      category: "editorial",
      attempts: 0,
      createdAt: "2026-06-05T00:00:00.000Z",
    },
  ],
  recentFailed: [],
  retryReadyFailed: [],
};

const degradedQueue: QueueStatus = {
  item: item("job-runner", "job-runner", "degraded", "failed jobs present"),
  counts: [
    {
      lane: "history.ingest",
      created: 0,
      retry: 0,
      active: 0,
      completed: 128,
      cancelled: 0,
      failed: 2,
      all: 130,
    },
  ],
  failedJobs: [
    {
      id: "job-1",
      lane: "history.ingest.dead",
      state: "failed",
      commandKind: "history.outbox.ingest",
      commandLane: "history.ingest",
      attemptCount: 3,
      createdAt: "2026-06-05T00:00:00.000Z",
    },
  ],
};

const meta = {
  title: "Admin/System Health/CDC Panel",
  component: CdcPanel,
  decorators: [
    (Story) => (
      <div className="max-w-[1100px] bg-surface-canvas p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CdcPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Healthy: Story = {
  args: {
    cdc: healthyCdc,
    historyOutbox: healthyHistoryOutbox,
    queue: healthyQueue,
    sequin: item("sequin", "Sequin", "available"),
  },
};

export const PendingOutboxMissedByCdc: Story = {
  args: {
    cdc: degradedCdc,
    historyOutbox: degradedHistoryOutbox,
    queue: degradedQueue,
    sequin: item(
      "sequin",
      "Sequin",
      "degraded",
      "service reachable but slot inactive",
    ),
  },
};

export const SequinDown: Story = {
  args: {
    cdc: healthyCdc,
    historyOutbox: healthyHistoryOutbox,
    queue: healthyQueue,
    sequin: item(
      "sequin",
      "Sequin",
      "unavailable",
      "health endpoint timed out",
    ),
  },
};

export const SlotMissing: Story = {
  args: {
    cdc: {
      ...healthyCdc,
      item: item(
        "cdc",
        "來源資料庫 CDC",
        "degraded",
        "replication slot missing",
      ),
      slotExists: false,
      slotActive: null,
      slotActivePid: null,
    },
    historyOutbox: healthyHistoryOutbox,
    queue: healthyQueue,
    sequin: item("sequin", "Sequin", "available"),
  },
};

export const PublicationDrift: Story = {
  args: {
    cdc: {
      ...healthyCdc,
      item: item(
        "cdc",
        "來源資料庫 CDC",
        "degraded",
        "publication tables drift from routed manifest",
      ),
      publicationTables: ["Unit", "Post", "LegacyTable"],
      missingTables: ["HistoryOutbox"],
      extraTables: ["LegacyTable"],
    },
    historyOutbox: healthyHistoryOutbox,
    queue: healthyQueue,
    sequin: item("sequin", "Sequin", "available"),
  },
};

export const FailedHistoryJob: Story = {
  args: {
    cdc: healthyCdc,
    historyOutbox: {
      ...healthyHistoryOutbox,
      item: item(
        "history-outbox",
        "HistoryOutbox",
        "degraded",
        "failed rows present",
      ),
      failed: 2,
      retryReady: 2,
      counts: { pending: 0, failed: 2, processing: 0, completed: 128 },
    },
    queue: degradedQueue,
    sequin: item("sequin", "Sequin", "available"),
  },
};

export const QueueDown: Story = {
  args: {
    cdc: healthyCdc,
    historyOutbox: healthyHistoryOutbox,
    queue: {
      ...healthyQueue,
      item: item(
        "job-runner",
        "job-runner",
        "unavailable",
        "ingress rejected health check",
      ),
      counts: [],
    },
    sequin: item("sequin", "Sequin", "available"),
  },
};
