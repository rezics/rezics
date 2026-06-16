import {
  addRealmFieldInputSchema,
  BasicAdminPermission,
  scoreAggregateDTOSchema,
  scoreEntryDTOSchema,
  scoreRealmFieldDTOSchema,
  upsertScoreInputSchema,
} from "@rezics/contract";
import { Elysia, status, t } from "elysia";
import { authMacro, verifyAdminFromDb } from "@/middleware";
import {
  mapScoreAggregateToDTO,
  mapScoreEntryToDTO,
  mapScoreRealmFieldToDTO,
} from "./score.mapper";
import { scoreService } from "./score.service";

export const scoreApi = new Elysia({ prefix: "/score" })
  .use(authMacro)

  // POST /score — upsert score (auth required)
  // POST /score —— 写入或更新评分（需要登录鉴权）
  .post(
    "/",
    async ({ body, identity }) => {
      const entry = await scoreService.upsertScore(
        identity.userId,
        body.unitId,
        body.realm,
        body.value,
        body.fields,
      );
      return mapScoreEntryToDTO(entry);
    },
    {
      requireLogin: true,
      body: upsertScoreInputSchema,
      detail: { summary: "Upsert score", tags: ["Score"] },
    },
  )

  // DELETE /score/:id — delete score (auth required)
  // DELETE /score/:id —— 删除评分（需要登录鉴权）
  .delete(
    "/:id",
    async ({ params, identity, set }) => {
      const isAdmin = BasicAdminPermission(identity.permission);
      try {
        await scoreService.deleteScore(params.id, isAdmin);
        return { message: "Score deleted" };
      } catch (err: any) {
        if (err.status === 409) {
          set.status = 409;
          return {
            error: "Cannot delete score with linked reviews",
            blockingIds: err.blockingIds,
          };
        }
        throw err;
      }
    },
    {
      requireLogin: true,
      params: t.Object({ id: t.String() }),
      detail: { summary: "Delete score", tags: ["Score"] },
    },
  )

  // GET /score/unit/:unitId — all realm aggregates for a unit
  // GET /score/unit/:unitId —— 某个 unit 的所有 realm 聚合数据
  .get(
    "/unit/:unitId",
    async ({ params }) => {
      const aggregates = await scoreService.getAggregatesByUnit(params.unitId);
      return aggregates.map(mapScoreAggregateToDTO);
    },
    {
      params: t.Object({ unitId: t.String() }),
      detail: {
        summary: "Get all realm aggregates for a unit",
        tags: ["Score"],
      },
    },
  )

  // GET /score/unit/:unitId/:realm — single realm aggregate
  // GET /score/unit/:unitId/:realm —— 单个 realm 的聚合数据
  .get(
    "/unit/:unitId/:realm",
    async ({ params }) => {
      const aggregate = await scoreService.getAggregate(
        params.unitId,
        params.realm,
      );
      return aggregate ? mapScoreAggregateToDTO(aggregate) : null;
    },
    {
      params: t.Object({ unitId: t.String(), realm: t.String() }),
      detail: { summary: "Get single realm aggregate", tags: ["Score"] },
    },
  )

  // GET /score/user/:userId/:unitId — user's score entries for a unit
  // GET /score/user/:userId/:unitId —— 用户针对某个 unit 的评分条目
  .get(
    "/user/:userId/:unitId",
    async ({ params }) => {
      const entries = await scoreService.getUserScores(
        params.userId,
        params.unitId,
      );
      return entries.map(mapScoreEntryToDTO);
    },
    {
      params: t.Object({ userId: t.String(), unitId: t.String() }),
      detail: { summary: "Get user's scores for a unit", tags: ["Score"] },
    },
  )

  // GET /score/user/:userId/:unitId/:realm — user's score for a specific realm
  // GET /score/user/:userId/:unitId/:realm —— 用户在特定 realm 中的评分
  .get(
    "/user/:userId/:unitId/:realm",
    async ({ params }) => {
      const entry = await scoreService.getUserScoreForRealm(
        params.userId,
        params.unitId,
        params.realm,
      );
      return entry ? mapScoreEntryToDTO(entry) : null;
    },
    {
      params: t.Object({
        userId: t.String(),
        unitId: t.String(),
        realm: t.String(),
      }),
      detail: {
        summary: "Get user's score for a specific realm",
        tags: ["Score"],
      },
    },
  )

  // POST /score/recalculate — admin recalculation endpoint
  // POST /score/recalculate —— 管理员触发的重新计算端点
  .post(
    "/recalculate",
    async ({ body, identity }) => {
      if (
        identity.permission.role !== "ADMIN" &&
        identity.permission.role !== "ROOT"
      ) {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.userId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      const aggregate = await scoreService.recalculateAggregate(
        body.unitId,
        body.realm,
      );
      return aggregate
        ? mapScoreAggregateToDTO(aggregate)
        : { message: "No entries, aggregate deleted" };
    },
    {
      requireLogin: true,
      body: t.Object({ unitId: t.String(), realm: t.String() }),
      detail: { summary: "Recalculate aggregate (admin)", tags: ["Score"] },
    },
  )

  // GET /score/realm/:realmId — list realm fields
  // GET /score/realm/:realmId —— 列出 realm 的字段
  .get(
    "/realm/:realmId",
    async ({ params }) => {
      const fields = await scoreService.listRealmFields(params.realmId);
      return fields.map(mapScoreRealmFieldToDTO);
    },
    {
      params: t.Object({ realmId: t.String() }),
      detail: { summary: "List realm fields", tags: ["Score"] },
    },
  )

  // POST /score/realm/:realmId — add field (admin)
  // POST /score/realm/:realmId —— 新增字段（管理员）
  .post(
    "/realm/:realmId",
    async ({ params, body, identity }) => {
      if (
        identity.permission.role !== "ADMIN" &&
        identity.permission.role !== "ROOT"
      ) {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.userId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      const field = await scoreService.addRealmField(
        params.realmId,
        body.key,
        body.label,
        body.sortOrder,
      );
      return mapScoreRealmFieldToDTO(field);
    },
    {
      requireLogin: true,
      params: t.Object({ realmId: t.String() }),
      body: addRealmFieldInputSchema,
      detail: { summary: "Add realm field (admin)", tags: ["Score"] },
    },
  )

  // DELETE /score/realm/:realmId/:key — remove field (admin)
  // DELETE /score/realm/:realmId/:key —— 移除字段（管理员）
  .delete(
    "/realm/:realmId/:key",
    async ({ params, identity, set }) => {
      if (
        identity.permission.role !== "ADMIN" &&
        identity.permission.role !== "ROOT"
      ) {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.userId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      try {
        await scoreService.removeRealmField(params.realmId, params.key);
        return { message: "Field removed" };
      } catch (err: any) {
        if (err.status === 404) {
          set.status = 404;
          return { error: err.message };
        }
        throw err;
      }
    },
    {
      requireLogin: true,
      params: t.Object({ realmId: t.String(), key: t.String() }),
      detail: { summary: "Remove realm field (admin)", tags: ["Score"] },
    },
  );
