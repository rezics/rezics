import { t } from "elysia";
import { unitTypeSchema } from "../unit/unit";

/**
 * Persisted `Subscription` row. `subscriberUnitId` is a USER `Unit.id`
 * in v1; `targetUnitId` is any `Unit.id`. The pair is unique.
 */
export const subscriptionDTOSchema = t.Object({
  id: t.String(),
  subscriberUnitId: t.String(),
  targetUnitId: t.String(),
  channels: t.Array(t.String()),
  createdAt: t.Union([t.String(), t.Date()]),
  updatedAt: t.Union([t.String(), t.Date()]),
});

export type SubscriptionDTO = (typeof subscriptionDTOSchema)["static"];

export const subscriptionCreateBodySchema = t.Object({
  targetUnitId: t.String(),
  channels: t.Optional(t.Array(t.String())),
});

export type SubscriptionCreateBody =
  (typeof subscriptionCreateBodySchema)["static"];

export const subscriptionPatchBodySchema = t.Object({
  channels: t.Array(t.String()),
});

export type SubscriptionPatchBody =
  (typeof subscriptionPatchBodySchema)["static"];

export const subscriptionParamsSchema = t.Object({
  targetUnitId: t.String(),
});

export type SubscriptionParams = (typeof subscriptionParamsSchema)["static"];

export const subscriptionListQuerySchema = t.Object({
  targetType: t.Optional(unitTypeSchema),
});

export type SubscriptionListQuery =
  (typeof subscriptionListQuerySchema)["static"];

export const subscriptionCheckResponseSchema = t.Object({
  subscribed: t.Boolean(),
  channels: t.Optional(t.Array(t.String())),
});

export type SubscriptionCheckResponse =
  (typeof subscriptionCheckResponseSchema)["static"];

export const subscriberCountResponseSchema = t.Object({
  count: t.Number(),
});

export type SubscriberCountResponse =
  (typeof subscriberCountResponseSchema)["static"];

export const subscriptionListResponseSchema = t.Object({
  subscriptions: t.Array(subscriptionDTOSchema),
});

export type SubscriptionListResponse =
  (typeof subscriptionListResponseSchema)["static"];
