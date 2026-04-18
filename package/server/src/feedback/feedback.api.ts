import {
  BasicAdminPermission,
  createFeedbackSchema,
  type FeedbackDTO,
  type FeedbackListResponse,
  feedbackListBodySchema,
  feedbackListQuerySchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro } from "@/middleware";
import { feedbackService } from "./feedback.service";
import { mapFeedbackToDTO } from "./mapper";

export const feedbackApi = new Elysia({ prefix: "/feedback" })
  .use(authMacro)
  .post(
    "/",
    async ({ body, identity }): Promise<FeedbackDTO> => {
      const created = await feedbackService.create({
        ...body,
        userId: identity.unitId,
      });
      return mapFeedbackToDTO(created);
    },
    {
      requireLogin: true,
      body: createFeedbackSchema,
      detail: {
        summary: "Create feedback",
        description:
          "Create a new feedback entry for the current user (optional unitId).",
        tags: ["Feedback"],
      },
    },
  )
  .get(
    "/my",
    async ({ query, identity }): Promise<FeedbackListResponse> => {
      const { userId: _ignoredUserId, ...rest } = query as any;
      const result = await feedbackService.list({
        ...(rest as any),
        userId: identity.unitId,
      });
      return { ...result, items: result.items.map(mapFeedbackToDTO) };
    },
    {
      requireLogin: true,
      query: feedbackListQuerySchema,
      detail: {
        summary: "List my feedbacks",
        description:
          "List feedbacks created by the current user, with optional filters.",
        tags: ["Feedback"],
      },
    },
  )
  .get(
    "/by-user/:userId",
    async ({ params, query, identity, set }): Promise<FeedbackListResponse> => {
      const isAdmin = BasicAdminPermission(identity.permission);
      if (!isAdmin && identity.unitId !== params.userId) {
        set.status = 403;
        throw new Error(
          "Forbidden: you can only query feedback for your own userId",
        );
      }

      const { userId: _ignoredUserId, ...rest } = query as any;
      const result = await feedbackService.list({
        ...(rest as any),
        userId: params.userId,
      });
      return { ...result, items: result.items.map(mapFeedbackToDTO) };
    },
    {
      requireLogin: true,
      params: t.Object({ userId: t.String() }),
      query: feedbackListQuerySchema,
      detail: {
        summary: "List feedbacks by userId",
        description:
          "List feedbacks for a specific userId. Non-admins can only access their own userId.",
        tags: ["Feedback", "Admin"],
      },
    },
  )
  .get(
    "/list",
    async ({ query, identity, set }): Promise<FeedbackListResponse> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to list all feedbacks",
        );
      }
      const result = await feedbackService.list(query as any);
      return { ...result, items: result.items.map(mapFeedbackToDTO) };
    },
    {
      requireLogin: true,
      query: feedbackListQuerySchema,
      detail: {
        summary: "List feedbacks (admin)",
        description:
          "Admin-only endpoint to list feedbacks with rich filters and pagination.",
        tags: ["Feedback", "Admin"],
      },
    },
  )
  .post(
    "/list",
    async ({ body, identity, set }): Promise<FeedbackListResponse> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to list all feedbacks",
        );
      }
      const result = await feedbackService.list({
        ...body,
        ids: body.ids?.join(","),
      } as any);
      return { ...result, items: result.items.map(mapFeedbackToDTO) };
    },
    {
      requireLogin: true,
      body: feedbackListBodySchema,
      detail: {
        summary: "List feedbacks (admin, POST)",
        description:
          "Admin-only POST list endpoint. Use when ids exceed URL length or filters contain nested objects.",
        tags: ["Feedback", "Admin"],
      },
    },
  )
  .get(
    "/:id",
    async ({ params, identity, set }): Promise<FeedbackDTO> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to get feedback details",
        );
      }
      const feedback = await feedbackService.getById(params.id);
      return mapFeedbackToDTO(feedback);
    },
    {
      requireLogin: true,
      params: t.Object({ id: t.String() }),
      detail: {
        summary: "Get feedback (admin)",
        description: "Admin-only endpoint to get a feedback by id.",
        tags: ["Feedback", "Admin"],
      },
    },
  )
  .patch(
    "/:id/resolve",
    async ({ params, body, identity, set }): Promise<FeedbackDTO> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to update feedback status",
        );
      }
      const resolved = (body as { resolved: boolean }).resolved;
      const feedback = await feedbackService.setResolved(params.id, resolved);
      return mapFeedbackToDTO(feedback);
    },
    {
      requireLogin: true,
      params: t.Object({ id: t.String() }),
      body: t.Object({
        resolved: t.Boolean(),
      }),
      detail: {
        summary: "Set feedback resolved state (admin)",
        description:
          "Admin-only endpoint to mark feedback as resolved or unresolved.",
        tags: ["Feedback", "Admin"],
      },
    },
  );
