import {
  type CommentListResponse,
  type CommentResponse,
  commentListBodySchema,
  commentListQuerySchema,
  commentListResponseSchema,
  commentParamsSchema,
  commentResponseSchema,
  createCommentSchema,
  updateCommentSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro, tryResolveIdentity } from "@/middleware";
import { postService } from "@/post/post.service";
import { mapCommentToDTO } from "./comment.mapper";
import { commentService } from "./comment.service";

export const commentApi = new Elysia({ prefix: "/comment" })
  .use(authMacro)
  .get(
    "/:unitId",
    async ({ params }): Promise<CommentResponse> => {
      return mapCommentToDTO(await commentService.getByUnitId(params.unitId));
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
      const { comments, total } = await commentService.list(query, {
        viewerUserId: identity?.userId,
      });
      const signals = await postService.getThreadPromotionSignals(
        query.rootUnitId,
        identity,
      );
      return { comments: comments.map(mapCommentToDTO), total, ...signals };
    },
    {
      query: commentListQuerySchema,
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
      const { comments, total } = await commentService.list(body, {
        viewerUserId: identity?.userId,
      });
      const signals = await postService.getThreadPromotionSignals(
        body.rootUnitId,
        identity,
      );
      return { comments: comments.map(mapCommentToDTO), total, ...signals };
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
    "/:unitId",
    async ({ params, body, identity }): Promise<CommentResponse> => {
      const comment = await commentService.update(
        params.unitId,
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
  .delete(
    "/:unitId",
    async ({ params, identity }): Promise<{ message: string }> => {
      await commentService.delete(params.unitId, identity.userId);
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
