import { t } from "elysia";
import { readLanguageGetQueryBase } from "../list-query-base";
import { paginationLimitSchema } from "../pagination";
import { unitTypeSchema } from "../unit/unit";

/**
 * Persisted `Subscription` row. `subscriberUnitId` is a USER `Unit.id`
 * in v1; `subscribedUnitId` is any `Unit.id`. The pair is unique.
 */
export const subscriptionDTOSchema = t.Object({
  id: t.String(),
  subscriberUnitId: t.String(),
  subscribedUnitId: t.String(),
  channels: t.Array(t.String()),
  createdAt: t.Union([t.String(), t.Date()]),
  updatedAt: t.Union([t.String(), t.Date()]),
});

export type SubscriptionDTO = (typeof subscriptionDTOSchema)["static"];

export const subscriptionCreateBodySchema = t.Object({
  subscribedUnitId: t.String(),
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
  subscribedUnitId: t.String(),
});

export type SubscriptionParams = (typeof subscriptionParamsSchema)["static"];

export const subscriptionListQuerySchema = t.Object({
  subscribedType: t.Optional(unitTypeSchema),
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

export const userSubscriptionListEntryStateSchema = t.Union([
  t.Literal("ACTIVE"),
  t.Literal("REMOVED"),
]);

export type UserSubscriptionListEntryState =
  (typeof userSubscriptionListEntryStateSchema)["static"];

export const userSubscriptionListSortSchema = t.Union([
  t.Literal("manualAsc"),
  t.Literal("manualDesc"),
  t.Literal("addedDesc"),
  t.Literal("addedAsc"),
]);

export type UserSubscriptionListSort =
  (typeof userSubscriptionListSortSchema)["static"];

export const userSubscriptionListEntryDTOSchema = t.Object({
  id: t.String(),
  userUnitId: t.String(),
  subscribedUnitId: t.String(),
  subscribedType: unitTypeSchema,
  subscribedSlug: t.Optional(t.Union([t.String(), t.Null()])),
  subscribedTitle: t.Optional(t.Union([t.String(), t.Null()])),
  position: t.String(), // Fractional Indexing
  pinned: t.Boolean(),
  state: userSubscriptionListEntryStateSchema,
  createdAt: t.Union([t.String(), t.Date()]),
  updatedAt: t.Union([t.String(), t.Date()]),
});

export type UserSubscriptionListEntryDTO =
  (typeof userSubscriptionListEntryDTOSchema)["static"];

export const userSubscriptionListEntryListQuerySchema = t.Object({
  ...readLanguageGetQueryBase.properties,
  subscribedType: t.Optional(unitTypeSchema),
  state: t.Optional(userSubscriptionListEntryStateSchema),
  sort: t.Optional(userSubscriptionListSortSchema),
  start: t.Optional(t.Number()),
  limit: paginationLimitSchema,
});

export type UserSubscriptionListEntryListQuery =
  (typeof userSubscriptionListEntryListQuerySchema)["static"];

export const userSubscriptionListEntryListResponseSchema = t.Object({
  entries: t.Array(userSubscriptionListEntryDTOSchema),
  total: t.Optional(t.Number()),
});

export type UserSubscriptionListEntryListResponse =
  (typeof userSubscriptionListEntryListResponseSchema)["static"];

export const userSubscriptionListEntryReorderBodySchema = t.Object({
  position: t.String({ minLength: 1 }), // Fractional Indexing
});

export type UserSubscriptionListEntryReorderBody =
  (typeof userSubscriptionListEntryReorderBodySchema)["static"];

export const userSubscriptionListEntryBatchReorderBodySchema = t.Object({
  entries: t.Array(
    t.Object({
      subscribedUnitId: t.String(),
      position: t.String({ minLength: 1 }),
    }),
    { minItems: 1, maxItems: 100 },
  ),
});

export type UserSubscriptionListEntryBatchReorderBody =
  (typeof userSubscriptionListEntryBatchReorderBodySchema)["static"];

export const userSubscriptionListEntryPinBodySchema = t.Object({
  pinned: t.Boolean(),
});

export type UserSubscriptionListEntryPinBody =
  (typeof userSubscriptionListEntryPinBodySchema)["static"];
