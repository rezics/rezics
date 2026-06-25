import { JobCommandSchema, safeParseJobCommand } from "@rezics/contract/job";
import { Elysia, t } from "elysia";
import * as v from "valibot";
import { rankingService } from "./service";

function parseRankingCommand(input: unknown) {
  const parsed = safeParseJobCommand(input);
  if (!parsed.success) {
    throw new Error("Invalid ranking command");
  }
  const command = parsed.output;
  if (!command.kind.startsWith("ranking.")) {
    throw new Error("Expected ranking command");
  }
  return v.parse(JobCommandSchema, command);
}

export const rankingApi = new Elysia({ prefix: "/ranking" })
  .get(
    "/ready",
    async ({ set }) => {
      const readiness = await rankingService.ready();
      if (readiness.status !== "ok") set.status = 503;
      return readiness;
    },
    {
      detail: { summary: "Ranking readiness", tags: ["Health"] },
    },
  )
  .post(
    "/command",
    async ({ body }) => {
      const command = parseRankingCommand(body);
      return rankingService.handleCommand(command as any);
    },
    {
      body: t.Any(),
      detail: { summary: "Handle ranking command", tags: ["Ranking"] },
    },
  )
  .get(
    "/projection/:unitId",
    async ({ params }) => rankingService.inspectUnit(params.unitId),
    {
      detail: { summary: "Inspect unit projections", tags: ["Ranking"] },
    },
  )
  .post(
    "/recompute/:unitId",
    async ({ params }) => rankingService.recomputeUnit(params.unitId),
    {
      detail: { summary: "Recompute one unit", tags: ["Ranking"] },
    },
  )
  .post(
    "/signal",
    async ({ body }) => rankingService.ingestSignal(body as any),
    {
      body: t.Object({
        unitId: t.String(),
        signalKind: t.Union([t.Literal("view"), t.Literal("read")]),
        at: t.Optional(t.String()),
        count: t.Optional(t.Number()),
        metadata: t.Optional(t.Any()),
      }),
      detail: { summary: "Ingest bucketed ranking signal", tags: ["Ranking"] },
    },
  );
