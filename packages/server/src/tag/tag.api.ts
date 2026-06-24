import type {
  AttachTagInput,
  BatchTagTranslationResult,
  CastTagVoteInput,
  CreateTagInput,
  TagUnitDTO,
  TagListQuery,
  UnitTagDTO,
  UpdateTagInput,
} from "@rezics/contract";
import {
  attachTagSchema,
  BasicAdminPermission,
  batchTagTranslationQuerySchema,
  castTagVoteSchema,
  createTagSchema,
  detachTagSchema,
  tagListBodySchema,
  tagListQuerySchema,
  tagParamsSchema,
  updateTagSchema,
} from "@rezics/contract";
import { Elysia, status, t } from "elysia";
import { governanceRoutePolicyService, realmPolicyActions } from "@/governance";
import { authMacro, tryResolveIdentity, verifyAdminFromDb } from "@/middleware";
import { unitService } from "@/unit/unit.service";
import { mapTagUnitToDTO, mapUnitTagToDTO } from "./tag.mapper";
import { tagService, VISIBILITY_THRESHOLD } from "./tag.service";
import { getTagContext } from "./tag-context.service";

async function assertTagVotePolicy(input: {
  identity: any;
  unitId: string;
  tagUnitId: string;
}) {
  const decision = await governanceRoutePolicyService.decideForIdentity({
    identity: input.identity,
    action: realmPolicyActions.tagVote,
    target: { kind: "tag-vote", id: `${input.unitId}:${input.tagUnitId}` },
  });
  if (!decision.allowed) {
    return status(
      403,
      decision.safeMessage ?? "Forbidden: policy denied this action",
    );
  }
}

export const tagApi = new Elysia({ prefix: "/tag" })
  .use(authMacro)

  // GET /list - list tags (search by name in language)
  // GET /list - 列出标签（按语言中的名称搜索）
  .get(
    "/list",
    async ({ query }): Promise<{ tags: TagUnitDTO[]; total: number }> => {
      const q = query as TagListQuery;
      const { tags, total } = await tagService.list(q);
      return {
        tags: tags.map((t) => mapTagUnitToDTO(t, q.language)),
        total,
      };
    },
    {
      query: tagListQuerySchema,
      detail: {
        summary: "List tags",
        description:
          "List tag Units with optional name search and language filter",
        tags: ["Tags"],
      },
    },
  )

  // POST /list - list tags via POST body
  // POST /list - 通过 POST 请求体列出标签
  .post(
    "/list",
    async ({ body }): Promise<{ tags: TagUnitDTO[]; total: number }> => {
      const q = { ...body, ids: body.ids?.join(",") } as TagListQuery;
      const { tags, total } = await tagService.list(q);
      return {
        tags: tags.map((t) => mapTagUnitToDTO(t, q.language)),
        total,
      };
    },
    {
      body: tagListBodySchema,
      detail: {
        summary: "List tags (POST)",
        description:
          "List tags via POST body. Use when ids exceed URL length or filters contain nested objects.",
        tags: ["Tags"],
      },
    },
  )

  // GET /batch-translations - resolve translations for a batch of tag unit IDs
  // GET /batch-translations - 解析一批标签 unit ID 的翻译
  .get(
    "/batch-translations",
    async ({ query }): Promise<BatchTagTranslationResult> => {
      const unitIds = (query.unitIds ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return tagService.batchTranslations(unitIds, query.lang);
    },
    {
      query: batchTagTranslationQuerySchema,
      detail: {
        summary: "Batch tag translations",
        description:
          "Resolve translated name/slug/description for an array of tag unit IDs in the requested language.",
        tags: ["Tags"],
      },
    },
  )

  // GET /by-slug/:slug - get tag by slug (404 if slug resolves to a non-tag)
  // GET /by-slug/:slug - 按 slug 获取标签（若 slug 解析为非标签则返回 404）
  .get(
    "/by-slug/:slug",
    async ({
      params,
      set,
    }): Promise<TagUnitDTO | { error: { code: string; message: string } }> => {
      const unit = await unitService.getBySlug("tag", params.slug);
      if (!unit || unit.type !== "TAG") {
        set.status = 404;
        return { error: { code: "NOT_FOUND", message: "Tag not found" } };
      }
      const tag = await tagService.getByUnitId(unit.id);
      return mapTagUnitToDTO(tag);
    },
    {
      params: t.Object({ slug: t.String({ minLength: 1 }) }),
      detail: {
        summary: "Get tag by slug",
        description:
          "Look up a tag by its slug (404 if slug resolves to a non-tag unit)",
        tags: ["Tags"],
      },
    },
  )

  // GET /:unitId - get tag by unitId
  // GET /:unitId - 按 unitId 获取标签
  .get(
    "/:unitId",
    async ({ params }): Promise<TagUnitDTO> => {
      const tag = await tagService.getByUnitId(params.unitId);
      return mapTagUnitToDTO(tag);
    },
    {
      params: tagParamsSchema,
      detail: { summary: "Get tag by unitId", tags: ["Tags"] },
    },
  )

  // POST / - create tag (requires login)
  // POST / - 创建标签（需要登录）
  .post(
    "/",
    async ({ body, identity }): Promise<TagUnitDTO> => {
      const created = await tagService.create(
        identity.userId,
        body as CreateTagInput,
      );
      return mapTagUnitToDTO(created);
    },
    {
      requireLogin: true,
      body: createTagSchema,
      detail: { summary: "Create tag", tags: ["Tags"] },
    },
  )

  // PUT /:unitId - update tag (admin)
  // PUT /:unitId - 更新标签（管理员）
  .put(
    "/:unitId",
    async ({ params, body, identity }): Promise<TagUnitDTO | string> => {
      if (
        identity.permission.role !== "ADMIN" &&
        identity.permission.role !== "ROOT"
      ) {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.userId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      const updated = await tagService.update(
        params.unitId,
        body as UpdateTagInput,
      );
      return mapTagUnitToDTO(updated);
    },
    {
      requireLogin: true,
      params: tagParamsSchema,
      body: updateTagSchema,
      detail: { summary: "Update tag (admin)", tags: ["Tags"] },
    },
  )

  // DELETE /:unitId - delete tag (admin)
  // DELETE /:unitId - 删除标签（管理员）
  .delete(
    "/:unitId",
    async ({ params, identity }) => {
      if (
        identity.permission.role !== "ADMIN" &&
        identity.permission.role !== "ROOT"
      ) {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.userId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      await tagService.delete(params.unitId);
      return { message: "Tag deleted successfully" };
    },
    {
      requireLogin: true,
      params: tagParamsSchema,
      detail: { summary: "Delete tag (admin)", tags: ["Tags"] },
    },
  )

  // POST /attach - attach tag to unit (admin); records the attach as the
  // admin actor's +1 vote so score derivation stays uniform.
  // POST /attach - 将标签附加到 unit（管理员）；将该附加操作记录为管理员
  // 操作者的 +1 投票，使得分推导保持一致。
  .post(
    "/attach",
    async ({ body, identity }) => {
      if (
        identity.permission.role !== "ADMIN" &&
        identity.permission.role !== "ROOT"
      ) {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.userId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      const { tagUnitId, unitId } = body as AttachTagInput;
      await tagService.createUnitTag(identity.userId, unitId, tagUnitId);
      return { message: "Tag attached successfully" };
    },
    {
      requireLogin: true,
      body: attachTagSchema,
      detail: { summary: "Attach tag to unit (admin)", tags: ["Tags"] },
    },
  )

  // POST /detach - detach tag from unit (admin)
  // POST /detach - 从 unit 解除标签（管理员）
  .post(
    "/detach",
    async ({ body, identity }) => {
      if (
        identity.permission.role !== "ADMIN" &&
        identity.permission.role !== "ROOT"
      ) {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.userId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      const { tagUnitId, unitId } = body as AttachTagInput;
      await tagService.deleteUnitTag(unitId, tagUnitId);
      return { message: "Tag detached successfully" };
    },
    {
      requireLogin: true,
      body: detachTagSchema,
      detail: { summary: "Detach tag from unit (admin)", tags: ["Tags"] },
    },
  )

  // POST /vote - cast tag vote (requires login)
  // POST /vote - 对标签投票（需要登录）
  .post(
    "/vote",
    async ({ body, identity }) => {
      const { tagUnitId, unitId, value } = body as CastTagVoteInput;
      const denied = await assertTagVotePolicy({ identity, unitId, tagUnitId });
      if (denied) return denied;
      await tagService.castVote(identity.userId, unitId, tagUnitId, value);
      return { message: "Vote cast successfully" };
    },
    {
      requireLogin: true,
      body: castTagVoteSchema,
      detail: { summary: "Cast tag vote", tags: ["Tags"] },
    },
  )

  // GET /for-unit/:unitId/context - get tag context for a unit
  // GET /for-unit/:unitId/context - 获取某个 unit 的标签上下文
  .get(
    "/for-unit/:unitId/context",
    async ({ headers, params }) => {
      const identity = await tryResolveIdentity(
        headers.authorization,
        headers.cookie,
      );
      const unit = await unitService.getByUnitId(params.unitId);
      const isPrivileged =
        (identity && BasicAdminPermission(identity.permission)) ||
        (identity?.userId != null && unit?.userId === identity.userId);
      return getTagContext(params.unitId, identity?.userId ?? undefined, {
        includeBelowThreshold: isPrivileged,
      });
    },
    {
      params: tagParamsSchema,
      detail: {
        summary: "Get tag context for a unit",
        description:
          "Pin-first/score-desc ordering. Rows with score ≤ -100 are hidden from regular callers and surfaced (with a flag) to admins / unit owner.",
        tags: ["Tags"],
      },
    },
  )

  // GET /for-unit/:unitId - get tags for a specific unit
  // GET /for-unit/:unitId - 获取特定 unit 的标签
  .get(
    "/for-unit/:unitId",
    async ({ headers, params }): Promise<{ tags: UnitTagDTO[] }> => {
      const identity = await tryResolveIdentity(
        headers.authorization,
        headers.cookie,
      );
      const unit = await unitService.getByUnitId(params.unitId);
      const isPrivileged =
        (identity && BasicAdminPermission(identity.permission)) ||
        (identity?.userId != null && unit?.userId === identity.userId);

      const unitTags = await tagService.getTagsForUnit(params.unitId, {
        includeBelowThreshold: isPrivileged,
      });
      const viewerVotes = identity?.userId
        ? await tagService.getViewerVotesForUnit(
            identity.userId,
            params.unitId,
            unitTags.map((unitTag) => unitTag.tagUnitId),
          )
        : new Map<string, number>();
      return {
        tags: unitTags.map((ut) =>
          mapUnitTagToDTO(ut, {
            belowVisibilityThreshold:
              isPrivileged && ut.score <= VISIBILITY_THRESHOLD,
            viewerVote: viewerVotes.get(ut.tagUnitId) ?? null,
          }),
        ),
      };
    },
    {
      params: tagParamsSchema,
      detail: {
        summary: "Get tags for a unit",
        description:
          "Pin-first/score-desc ordering. Rows with score ≤ -100 are hidden from regular callers and surfaced (with a flag) to admins / unit owner.",
        tags: ["Tags"],
      },
    },
  );
