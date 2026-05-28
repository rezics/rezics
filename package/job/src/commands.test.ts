import { describe, expect, test } from "bun:test";
import * as v from "valibot";
import {
  createHistoryOutboxIngestCommand,
  createIdempotencyKey,
  createMaintenanceCommand,
  createRankingCommand,
  createSearchCommand,
  HISTORY_COMMAND_KINDS,
  JOB_LANES,
  JobCommandSchema,
  jobTags,
  MAINTENANCE_COMMAND_KINDS,
  RANKING_COMMAND_KINDS,
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

  test("validates work-domain search repair commands", () => {
    const workCommand = createSearchCommand(
      SEARCH_COMMAND_KINDS.contentSyncWorkReleases,
      { targetId: "work-1", cursor: "release-1", limit: 50 },
    );
    const fullCommand = createSearchCommand(
      SEARCH_COMMAND_KINDS.contentWorkDomainFullSync,
      { cursor: "release-1", limit: 50 },
    );
    const gameMediaCommand = createSearchCommand(
      SEARCH_COMMAND_KINDS.contentGameMediaFullSync,
      { cursor: "game-1", limit: 50 },
    );

    expect(workCommand.lane).toBe(JOB_LANES.searchSyncSlow);
    expect(workCommand.idempotencyKey).toBe(
      "search.content.syncWorkReleases:work-1:release-1",
    );
    expect(fullCommand.lane).toBe(JOB_LANES.maintenance);
    expect(fullCommand.idempotencyKey).toBe(
      "search.content.workDomainFullSync:all:release-1",
    );
    expect(gameMediaCommand.lane).toBe(JOB_LANES.maintenance);
    expect(gameMediaCommand.idempotencyKey).toBe(
      "search.content.gameMediaFullSync:all:game-1",
    );
    expect(v.parse(JobCommandSchema, workCommand)).toEqual(workCommand);
    expect(v.parse(JobCommandSchema, fullCommand)).toEqual(fullCommand);
    expect(v.parse(JobCommandSchema, gameMediaCommand)).toEqual(
      gameMediaCommand,
    );
  });

  test("validates GAME/MEDIA search drift repair targets", () => {
    const platformCommand = createMaintenanceCommand(
      MAINTENANCE_COMMAND_KINDS.searchDriftRepair,
      { targetType: "game-media-platforms", targetId: "all" },
    );
    const ratingCommand = createMaintenanceCommand(
      MAINTENANCE_COMMAND_KINDS.searchDriftRepair,
      { targetType: "game-media-ratings", targetId: "all" },
    );

    expect(platformCommand.idempotencyKey).toBe(
      "maintenance.search.driftRepair:game-media-platforms:all",
    );
    expect(ratingCommand.idempotencyKey).toBe(
      "maintenance.search.driftRepair:game-media-ratings:all",
    );
    expect(v.parse(JobCommandSchema, platformCommand)).toEqual(platformCommand);
    expect(v.parse(JobCommandSchema, ratingCommand)).toEqual(ratingCommand);
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

  test("validates Series repair maintenance commands", () => {
    const indexCommand = createMaintenanceCommand(
      MAINTENANCE_COMMAND_KINDS.seriesContentIndexRepair,
      { seriesUnitId: "series-1" },
    );
    const projectionCommand = createMaintenanceCommand(
      MAINTENANCE_COMMAND_KINDS.seriesWorkProjectionRepair,
      { seriesUnitId: "series-1" },
    );

    expect(indexCommand.idempotencyKey).toBe(
      "maintenance.series:contentIndex:series-1",
    );
    expect(projectionCommand.idempotencyKey).toBe(
      "maintenance.series:workProjection:series-1",
    );
    expect(v.parse(JobCommandSchema, indexCommand)).toEqual(indexCommand);
    expect(v.parse(JobCommandSchema, projectionCommand)).toEqual(
      projectionCommand,
    );
  });

  test("validates ranking commands with stable target idempotency", () => {
    const command = createRankingCommand(RANKING_COMMAND_KINDS.invalidate, {
      unitId: "unit-1",
      scope: { kind: "realm", id: "realm-1" },
      rankKind: "post",
    });

    expect(command.kind).toBe("ranking.invalidate");
    expect(command.lane).toBe(JOB_LANES.ranking);
    expect(command.idempotencyKey).toBe(
      "ranking.invalidate:unit-1:realm:realm-1:post",
    );
    expect(command.tags).toContain("domain:ranking");
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
