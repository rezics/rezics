import { t } from "elysia";
import {
  creditAttributionDTOSchema,
  entityAttributionBatchSetCreditsOpSchema,
} from "./credit-attribution";
import {
  entityAttributionBatchSetSubjectsOpSchema,
  subjectAttributionDTOSchema,
} from "./subject-attribution";

export const entityAttributionBatchParamsSchema = t.Object({
  unitId: t.String(),
});

export type EntityAttributionBatchParams =
  (typeof entityAttributionBatchParamsSchema)["static"];

export const entityAttributionBatchOpSchema = t.Union([
  entityAttributionBatchSetCreditsOpSchema,
  entityAttributionBatchSetSubjectsOpSchema,
]);

export type EntityAttributionBatchOp =
  (typeof entityAttributionBatchOpSchema)["static"];

export const entityAttributionBatchRequestSchema = t.Object({
  baseVersion: t.Optional(t.String()),
  message: t.Optional(t.String()),
  ops: t.Array(entityAttributionBatchOpSchema),
});

export type EntityAttributionBatchRequest =
  (typeof entityAttributionBatchRequestSchema)["static"];

export const entityAttributionBatchResponseSchema = t.Object({
  unitId: t.String(),
  changed: t.Boolean(),
  credits: t.Array(creditAttributionDTOSchema),
  subjects: t.Array(subjectAttributionDTOSchema),
});

export type EntityAttributionBatchResponse =
  (typeof entityAttributionBatchResponseSchema)["static"];
