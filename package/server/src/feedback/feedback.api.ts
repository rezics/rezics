import {
  createFeedbackSchema,
  type FeedbackDTO,
  type FeedbackListResponse,
  feedbackListBodySchema,
  feedbackListQuerySchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { governanceRoutePolicyService, sitePolicyActions } from "@/governance";
import { authMacro } from "@/middleware";
import { feedbackService } from "./feedback.service";
import { mapFeedbackToDTO } from "./mapper";

async function assertFeedbackPolicy(input: {
  identity: any;
  status: any;
  action: (typeof sitePolicyActions)[keyof typeof sitePolicyActions];
  target: {
    kind: string;
    id: string;
  };
}) {
  const decision = await governanceRoutePolicyService.decideForIdentity({
    identity: input.identity,
    action: input.action,
    target: input.target,
  });
  if (!decision.allowed) {
    return input.status(
      403,
      decision.safeMessage ?? "Forbidden: policy denied this action",
    );
  }
}

export const feedbackApi = new Elysia({ prefix: "/feedback" })
  .use(authMacro)
  .post(
    "/",
    async ({ body, identity }): Promise<FeedbackDTO> => {
      const created = await feedbackService.create({
        ...body,
        userId: identity.userId,
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
        userId: identity.userId,
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
    async ({
      params,
      query,
      identity,
      status,
    }): Promise<FeedbackListResponse | string> => {
      if (identity.userId !== params.userId) {
        const denied = await assertFeedbackPolicy({
          identity,
          status,
          action: sitePolicyActions.auditRead,
          target: { kind: "feedback-user", id: params.userId },
        });
        if (denied) return denied;
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
      response: {
        200: t.Any(),
        403: t.String(),
      },
      detail: {
        summary: "List feedbacks by userId",
        description: "List feedbacks for a specific userId.",
        tags: ["Feedback", "Admin"],
      },
    },
  )
  .get(
    "/list",
    async ({
      query,
      identity,
      status,
    }): Promise<FeedbackListResponse | string> => {
      const denied = await assertFeedbackPolicy({
        identity,
        status,
        action: sitePolicyActions.auditRead,
        target: { kind: "feedback-list", id: "all" },
      });
      if (denied) return denied;
      const result = await feedbackService.list(query as any);
      return { ...result, items: result.items.map(mapFeedbackToDTO) };
    },
    {
      requireLogin: true,
      query: feedbackListQuerySchema,
      response: {
        200: t.Any(),
        403: t.String(),
      },
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
    async ({
      body,
      identity,
      status,
    }): Promise<FeedbackListResponse | string> => {
      const denied = await assertFeedbackPolicy({
        identity,
        status,
        action: sitePolicyActions.auditRead,
        target: { kind: "feedback-list", id: "all" },
      });
      if (denied) return denied;
      const result = await feedbackService.list({
        ...body,
        ids: body.ids?.join(","),
      } as any);
      return { ...result, items: result.items.map(mapFeedbackToDTO) };
    },
    {
      requireLogin: true,
      body: feedbackListBodySchema,
      response: {
        200: t.Any(),
        403: t.String(),
      },
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
    async ({ params, identity, status }): Promise<FeedbackDTO | string> => {
      const denied = await assertFeedbackPolicy({
        identity,
        status,
        action: sitePolicyActions.auditRead,
        target: { kind: "feedback", id: params.id },
      });
      if (denied) return denied;
      const feedback = await feedbackService.getById(params.id);
      return mapFeedbackToDTO(feedback);
    },
    {
      requireLogin: true,
      params: t.Object({ id: t.String() }),
      response: {
        200: t.Any(),
        403: t.String(),
      },
      detail: {
        summary: "Get feedback (admin)",
        description: "Admin-only endpoint to get a feedback by id.",
        tags: ["Feedback", "Admin"],
      },
    },
  )
  .patch(
    "/:id/resolve",
    async ({
      params,
      body,
      identity,
      status,
    }): Promise<FeedbackDTO | string> => {
      const denied = await assertFeedbackPolicy({
        identity,
        status,
        action: sitePolicyActions.queueDecide,
        target: { kind: "feedback", id: params.id },
      });
      if (denied) return denied;
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
      response: {
        200: t.Any(),
        403: t.String(),
      },
      detail: {
        summary: "Set feedback resolved state (admin)",
        description:
          "Admin-only endpoint to mark feedback as resolved or unresolved.",
        tags: ["Feedback", "Admin"],
      },
    },
  );
