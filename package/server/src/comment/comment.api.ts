import {
  type CommentListContext,
  type CommentListResponse,
  type CommentResponse,
  commentListBodySchema,
  commentListContextSchema,
  commentListQuerySchema,
  commentListResponseSchema,
  commentModerationInputSchema,
  commentParamsSchema,
  commentResponseSchema,
  createCommentSchema,
  updateCommentSchema,
} from "@rezics/contract";
import { Value } from "@sinclair/typebox/value";
import { Elysia, t } from "elysia";
import { governanceModerationService } from "@/governance";
import { authMacro, tryResolveIdentity } from "@/middleware";
import { postService } from "@/post/post.service";
import { AppError } from "@/utils/errors";
import { mapCommentToDTO } from "./comment.mapper";
import { commentService } from "./comment.service";

// Elysia cannot coerce a JSON-encoded query param into the context union
// (it validates against the first member only), so the GET route accepts the
// raw JSON string and parses it here. POST /comment/list stays fully typed.
// Elysia 无法把 JSON 编码的查询参数强制转换为 context 联合类型（只会按第一个
// 成员校验），所以 GET 路由接受原始 JSON 字符串并在此解析。POST /comment/list
// 保持完整类型化。
const commentListGetQuerySchema = t.Composite([
  t.Omit(commentListQuerySchema, ["context"]),
  t.Object({ context: t.Optional(t.String()) }),
]);

function parseCommentListContext(
  raw: string | undefined,
): CommentListContext | undefined {
  if (raw === undefined) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppError(422, "context must be a JSON-encoded list context");
  }
  if (!Value.Check(commentListContextSchema, parsed)) {
    throw new AppError(422, "context must be a valid comment list context");
  }
  return parsed;
}

export const commentApi = new Elysia({ prefix: "/comment" })
  .use(authMacro)
  .get(
    "/:id",
    async ({ params }): Promise<CommentResponse> => {
      return mapCommentToDTO(await commentService.getById(params.id));
    },
    {
      params: commentParamsSchema,
      response: commentResponseSchema,
      detail: {
        summary: "Get comment",
        tags: ["Comments"],
      },
    },
  )
  .get(
    "/list",
    async ({ headers, query }): Promise<CommentListResponse> => {
      const identity = await tryResolveIdentity(
        headers["authorization"],
        headers["cookie"],
      );
      const result = await commentService.list(
        { ...query, context: parseCommentListContext(query.context) },
        { viewerUserId: identity?.userId },
      );
      const signals = await postService.getThreadPromotionSignals(
        query.rootUnitId,
        identity,
      );
      return {
        mode: query.mode,
        comments: result.comments.map(mapCommentToDTO),
        rootComment: result.rootComment
          ? mapCommentToDTO(result.rootComment)
          : null,
        parentContexts: result.parentContexts?.map(mapCommentToDTO) ?? [],
        nextCursor: result.nextCursor ?? null,
        total: result.total,
        ...signals,
      };
    },
    {
      query: commentListGetQuerySchema,
      response: commentListResponseSchema,
      detail: {
        summary: "List comments",
        tags: ["Comments"],
      },
    },
  )
  .post(
    "/list",
    async ({ headers, body }): Promise<CommentListResponse> => {
      const identity = await tryResolveIdentity(
        headers["authorization"],
        headers["cookie"],
      );
      const result = await commentService.list(body, {
        viewerUserId: identity?.userId,
      });
      const signals = await postService.getThreadPromotionSignals(
        body.rootUnitId,
        identity,
      );
      return {
        mode: body.mode,
        comments: result.comments.map(mapCommentToDTO),
        rootComment: result.rootComment
          ? mapCommentToDTO(result.rootComment)
          : null,
        parentContexts: result.parentContexts?.map(mapCommentToDTO) ?? [],
        nextCursor: result.nextCursor ?? null,
        total: result.total,
        ...signals,
      };
    },
    {
      body: commentListBodySchema,
      response: commentListResponseSchema,
      detail: {
        summary: "List comments with body filters",
        tags: ["Comments"],
      },
    },
  )
  .post(
    "/",
    async ({ body, identity }): Promise<CommentResponse> => {
      const comment = await commentService.create(body, identity.userId);
      return mapCommentToDTO(comment);
    },
    {
      requireLogin: true,
      body: createCommentSchema,
      response: commentResponseSchema,
      detail: {
        summary: "Create comment",
        tags: ["Comments"],
      },
    },
  )
  .patch(
    "/:id",
    async ({ params, body, identity }): Promise<CommentResponse> => {
      const comment = await commentService.update(
        params.id,
        body,
        identity.userId,
      );
      return mapCommentToDTO(comment);
    },
    {
      requireLogin: true,
      params: commentParamsSchema,
      body: updateCommentSchema,
      response: commentResponseSchema,
      detail: {
        summary: "Update comment",
        tags: ["Comments"],
      },
    },
  )
  .post(
    "/:id/moderation",
    async ({ params, body, identity }): Promise<CommentResponse> => {
      await governanceModerationService.moderateComment({
        commentId: params.id,
        actorUserId: identity.userId,
        identity,
        ...body,
      });
      return mapCommentToDTO(await commentService.getById(params.id));
    },
    {
      requireLogin: true,
      params: commentParamsSchema,
      body: commentModerationInputSchema,
      response: commentResponseSchema,
      detail: {
        summary: "Moderate comment",
        description:
          "Remove, restore, lock, or unlock a comment. Removed comments return as redacted stubs on public reads.",
        tags: ["Comments"],
      },
    },
  )
  .delete(
    "/:id",
    async ({ params, identity }): Promise<{ message: string }> => {
      await commentService.delete(params.id, identity.userId);
      return { message: "Comment deleted" };
    },
    {
      requireLogin: true,
      params: commentParamsSchema,
      response: t.Object({ message: t.String() }),
      detail: {
        summary: "Delete comment",
        tags: ["Comments"],
      },
    },
  );
