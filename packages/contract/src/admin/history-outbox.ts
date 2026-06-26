import { t } from "elysia";

export const retryHistoryOutboxInputSchema = t.Object({
  unitId: t.Optional(t.String()),
});
export type RetryHistoryOutboxInput =
  (typeof retryHistoryOutboxInputSchema)["static"];

export const retryHistoryOutboxResponseSchema = t.Object({
  retried: t.Number(),
});
export type RetryHistoryOutboxResponse =
  (typeof retryHistoryOutboxResponseSchema)["static"];
