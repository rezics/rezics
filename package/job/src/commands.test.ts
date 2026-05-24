import { describe, expect, test } from "bun:test";
import * as v from "valibot";
import {
  createHistoryOutboxIngestCommand,
  createIdempotencyKey,
  createMaintenanceCommand,
  createSearchCommand,
  HISTORY_COMMAND_KINDS,
  JOB_LANES,
  JobCommandSchema,
  jobTags,
  MAINTENANCE_COMMAND_KINDS,
  SEARCH_COMMAND_KINDS,
} from ".";

describe("@rezics/job command contract", () => {
  test("validates search commands with the expected lane", () => {
    const command = createSearchCommand(SEARCH_COMMAND_KINDS.contentPatchTags, {
      unitId: "unit-1",
    });

    expect(command.kind).toBe("search.content.patchTags");
    expect(command.lane).toBe(JOB_LANES.searchSyncSlow);
    expect(command.idempotencyKey).toBe("search.content.patchTags:unit-1");
    expect(v.parse(JobCommandSchema, command)).toEqual(command);
  });

  test("validates history outbox ingest commands", () => {
    const command = createHistoryOutboxIngestCommand("outbox-1");

    expect(command.kind).toBe(HISTORY_COMMAND_KINDS.outboxIngest);
    expect(command.lane).toBe(JOB_LANES.historyIngest);
    expect(command.idempotencyKey).toBe("history.outbox.ingest:outbox-1");
    expect(command.tags).toContain("domain:history");
    expect(v.parse(JobCommandSchema, command)).toEqual(command);
  });

  test("validates rebuild maintenance commands with cursor idempotency", () => {
    const command = createMaintenanceCommand(
      MAINTENANCE_COMMAND_KINDS.searchRebuildIndex,
      { index: "content", cursor: "unit-1", limit: 100 },
    );

    expect(command.kind).toBe("maintenance.search.rebuildIndex");
    expect(command.lane).toBe(JOB_LANES.maintenance);
    expect(command.idempotencyKey).toBe(
      "maintenance.search.rebuildIndex:content:unit-1",
    );
    expect(v.parse(JobCommandSchema, command)).toEqual(command);
  });

  test("normalizes idempotency key parts", () => {
    expect(
      createIdempotencyKey("search.progress.sync", "user:1", "unit:1"),
    ).toBe("search.progress.sync:user_1:unit_1");
  });

  test("creates typed observability tags", () => {
    expect(jobTags.domain("search")).toBe("domain:search");
    expect(jobTags.effect("sync")).toBe("effect:sync");
    expect(jobTags.index("content")).toBe("index:content");
  });
});
