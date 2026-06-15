import type {
  SubscriberCountResponse,
  SubscriptionCheckResponse,
  SubscriptionDTO,
  SubscriptionListResponse,
  UserSubscriptionListEntryDTO,
  UserSubscriptionListEntryListResponse,
} from "@rezics/contract";
import {
  parseReadLanguages,
  subscriberCountResponseSchema,
  subscriptionCheckResponseSchema,
  subscriptionCreateBodySchema,
  subscriptionDTOSchema,
  subscriptionListQuerySchema,
  subscriptionListResponseSchema,
  subscriptionParamsSchema,
  subscriptionPatchBodySchema,
  userSubscriptionListEntryBatchReorderBodySchema,
  userSubscriptionListEntryDTOSchema,
  userSubscriptionListEntryListQuerySchema,
  userSubscriptionListEntryListResponseSchema,
  userSubscriptionListEntryPinBodySchema,
  userSubscriptionListEntryReorderBodySchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro } from "@/middleware";
import { subscriptionService } from "./subscription.service";
import { subscriptionListEntryService } from "./subscription-list-entry.service";

export const subscriptionApi = new Elysia({ prefix: "/subscription" })
  .use(authMacro)
  .post(
    "/",
    async ({ body, identity }): Promise<SubscriptionDTO> => {
      return subscriptionService.subscribe(
        identity.userId,
        body.subscribedUnitId,
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
          "Subscribe the authenticated user to a subscribed Unit. Defaults channels to ['*'].",
        tags: ["Subscription"],
      },
    },
  )
  .get(
    "/entries",
    async ({
      query,
      identity,
    }): Promise<UserSubscriptionListEntryListResponse> => {
      const entries = await subscriptionListEntryService.list({
        userUnitId: identity.userId,
        subscribedType: query.subscribedType,
        state: query.state,
        sort: query.sort,
        start: query.start,
        limit: query.limit,
        preferredLanguages: parseReadLanguages([
          query.appLocale,
          ...parseReadLanguages(query.languages),
        ]),
      });
      return entries;
    },
    {
      requireLogin: true,
      query: userSubscriptionListEntryListQuerySchema,
      response: userSubscriptionListEntryListResponseSchema,
      detail: {
        summary: "List my subscription list entries",
        description:
          "List subscription-list metadata for the caller, ordered by pinned state and position. Defaults to ACTIVE entries.",
        tags: ["Subscription"],
      },
    },
  )
  .patch(
    "/entries/reorder",
    async ({ body, identity }): Promise<UserSubscriptionListEntryDTO[]> => {
      return subscriptionListEntryService.reorderBatch({
        userUnitId: identity.userId,
        entries: body.entries,
      });
    },
    {
      requireLogin: true,
      body: userSubscriptionListEntryBatchReorderBodySchema,
      response: t.Array(userSubscriptionListEntryDTOSchema),
      detail: {
        summary: "Batch reorder subscription list entries",
        description:
          "Updates multiple fractional positions in one transaction for drag-and-drop list/sidebar ordering.",
        tags: ["Subscription"],
      },
    },
  )
  .patch(
    "/entries/:subscribedUnitId/pin",
    async ({
      params,
      body,
      identity,
    }): Promise<UserSubscriptionListEntryDTO> => {
      return subscriptionListEntryService.pin({
        userUnitId: identity.userId,
        subscribedUnitId: params.subscribedUnitId,
        pinned: body.pinned,
      });
    },
    {
      requireLogin: true,
      params: subscriptionParamsSchema,
      body: userSubscriptionListEntryPinBodySchema,
      response: userSubscriptionListEntryDTOSchema,
      detail: {
        summary: "Pin or unpin a subscription list entry",
        description:
          "Pinning affects list/sidebar ordering only; it does not create or remove a Subscription row.",
        tags: ["Subscription"],
      },
    },
  )
  .patch(
    "/entries/:subscribedUnitId/reorder",
    async ({
      params,
      body,
      identity,
    }): Promise<UserSubscriptionListEntryDTO> => {
      return subscriptionListEntryService.reorder({
        userUnitId: identity.userId,
        subscribedUnitId: params.subscribedUnitId,
        position: body.position,
      });
    },
    {
      requireLogin: true,
      params: subscriptionParamsSchema,
      body: userSubscriptionListEntryReorderBodySchema,
      response: userSubscriptionListEntryDTOSchema,
      detail: {
        summary: "Reorder a subscription list entry",
        description:
          "Updates the fractional position for list/sidebar ordering without changing subscription channels.",
        tags: ["Subscription"],
      },
    },
  )
  .delete(
    "/entries/:subscribedUnitId",
    async ({ params, identity }): Promise<{ removed: boolean }> => {
      await subscriptionListEntryService.markRemoved({
        userUnitId: identity.userId,
        subscribedUnitId: params.subscribedUnitId,
      });
      return { removed: true };
    },
    {
      requireLogin: true,
      params: subscriptionParamsSchema,
      detail: {
        summary: "Remove a subscription from my list",
        description:
          "Marks the list entry REMOVED while leaving the Subscription row intact.",
        tags: ["Subscription"],
      },
    },
  )
  .post(
    "/entries/:subscribedUnitId/recover",
    async ({ params, identity }): Promise<UserSubscriptionListEntryDTO> => {
      return subscriptionListEntryService.recover({
        userUnitId: identity.userId,
        subscribedUnitId: params.subscribedUnitId,
      });
    },
    {
      requireLogin: true,
      params: subscriptionParamsSchema,
      response: userSubscriptionListEntryDTOSchema,
      detail: {
        summary: "Recover a removed subscription list entry",
        description:
          "Best-effort recovery: recreates the Subscription when permitted and marks the list entry ACTIVE.",
        tags: ["Subscription"],
      },
    },
  )
  .delete(
    "/:subscribedUnitId",
    async ({ params, identity }): Promise<{ unsubscribed: boolean }> => {
      const ok = await subscriptionService.unsubscribe(
        identity.userId,
        params.subscribedUnitId,
      );
      return { unsubscribed: ok };
    },
    {
      requireLogin: true,
      params: subscriptionParamsSchema,
      detail: {
        summary: "Delete subscription",
        description:
          "Remove the caller's subscription to the subscribed Unit. Idempotent (returns unsubscribed:false if no row existed).",
        tags: ["Subscription"],
      },
    },
  )
  .patch(
    "/:subscribedUnitId",
    async ({ params, body, identity }): Promise<SubscriptionDTO> => {
      return subscriptionService.updateChannels(
        identity.userId,
        params.subscribedUnitId,
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
          "Replace the channels filter on the caller's existing subscription to a subscribed Unit.",
        tags: ["Subscription"],
      },
    },
  )
  .get(
    "/me",
    async ({ query, identity }): Promise<SubscriptionListResponse> => {
      const subscriptions = await subscriptionService.listMine(
        identity.userId,
        { subscribedType: query.subscribedType },
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
          "List the caller's subscriptions; optional ?subscribedType filter.",
        tags: ["Subscription"],
      },
    },
  )
  .get(
    "/check/:subscribedUnitId",
    async ({ params, identity }): Promise<SubscriptionCheckResponse> => {
      return subscriptionService.checkSubscription(
        identity.userId,
        params.subscribedUnitId,
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
    "/count/:subscribedUnitId",
    async ({ params }): Promise<SubscriberCountResponse> => {
      const count = await subscriptionService.getSubscriberCount(
        params.subscribedUnitId,
      );
      return { count };
    },
    {
      params: subscriptionParamsSchema,
      response: subscriberCountResponseSchema,
      detail: {
        summary: "Get subscriber count",
        description:
          "Read the cached subscriberCount for a subscribed Unit. Public; no auth required.",
        tags: ["Subscription"],
      },
    },
  );

export default subscriptionApi;
