import type {
  SubscriberCountResponse,
  SubscriptionCheckResponse,
  SubscriptionDTO,
  SubscriptionListResponse,
} from "@rezics/contract";
import {
  subscriberCountResponseSchema,
  subscriptionCheckResponseSchema,
  subscriptionCreateBodySchema,
  subscriptionDTOSchema,
  subscriptionListQuerySchema,
  subscriptionListResponseSchema,
  subscriptionParamsSchema,
  subscriptionPatchBodySchema,
} from "@rezics/contract";
import { Elysia } from "elysia";
import { authMacro } from "@/middleware";
import { subscriptionService } from "./subscription.service";

export const subscriptionApi = new Elysia({ prefix: "/subscription" })
  .use(authMacro)
  .post(
    "/",
    async ({ body, identity }): Promise<SubscriptionDTO> => {
      return subscriptionService.subscribe(
        identity.userId,
        body.targetUnitId,
        body.channels,
      );
    },
    {
      requireLogin: true,
      body: subscriptionCreateBodySchema,
      response: subscriptionDTOSchema,
      detail: {
        summary: "Create subscription",
        description:
          "Subscribe the authenticated user to a target Unit. Defaults channels to ['*'].",
        tags: ["Subscription"],
      },
    },
  )
  .delete(
    "/:targetUnitId",
    async ({ params, identity }): Promise<{ unsubscribed: boolean }> => {
      const ok = await subscriptionService.unsubscribe(
        identity.userId,
        params.targetUnitId,
      );
      return { unsubscribed: ok };
    },
    {
      requireLogin: true,
      params: subscriptionParamsSchema,
      detail: {
        summary: "Delete subscription",
        description:
          "Remove the caller's subscription to the target Unit. Idempotent (returns unsubscribed:false if no row existed).",
        tags: ["Subscription"],
      },
    },
  )
  .patch(
    "/:targetUnitId",
    async ({ params, body, identity }): Promise<SubscriptionDTO> => {
      return subscriptionService.updateChannels(
        identity.userId,
        params.targetUnitId,
        body.channels,
      );
    },
    {
      requireLogin: true,
      params: subscriptionParamsSchema,
      body: subscriptionPatchBodySchema,
      response: subscriptionDTOSchema,
      detail: {
        summary: "Update subscription channels",
        description:
          "Replace the channels filter on the caller's existing subscription to a target Unit.",
        tags: ["Subscription"],
      },
    },
  )
  .get(
    "/me",
    async ({ query, identity }): Promise<SubscriptionListResponse> => {
      const subscriptions = await subscriptionService.listMine(
        identity.userId,
        { targetType: query.targetType },
      );
      return { subscriptions };
    },
    {
      requireLogin: true,
      query: subscriptionListQuerySchema,
      response: subscriptionListResponseSchema,
      detail: {
        summary: "List my subscriptions",
        description:
          "List the caller's subscriptions; optional ?targetType filter.",
        tags: ["Subscription"],
      },
    },
  )
  .get(
    "/check/:targetUnitId",
    async ({ params, identity }): Promise<SubscriptionCheckResponse> => {
      return subscriptionService.checkSubscription(
        identity.userId,
        params.targetUnitId,
      );
    },
    {
      requireLogin: true,
      params: subscriptionParamsSchema,
      response: subscriptionCheckResponseSchema,
      detail: {
        summary: "Check subscription",
        description: "Return { subscribed, channels? } for the caller.",
        tags: ["Subscription"],
      },
    },
  )
  .get(
    "/count/:targetUnitId",
    async ({ params }): Promise<SubscriberCountResponse> => {
      const count = await subscriptionService.getSubscriberCount(
        params.targetUnitId,
      );
      return { count };
    },
    {
      params: subscriptionParamsSchema,
      response: subscriberCountResponseSchema,
      detail: {
        summary: "Get subscriber count",
        description:
          "Read the cached subscriberCount for a target Unit. Public; no auth required.",
        tags: ["Subscription"],
      },
    },
  );

export default subscriptionApi;
