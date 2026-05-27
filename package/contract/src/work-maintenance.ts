import { t } from "elysia";
import { languageSchema } from "./language";
import { unitTranslationDTOSchema } from "./unit";

export const workMaintenanceDTOSchema = t.Object({
  unitId: t.String(),
  type: t.String(),
  translations: t.Array(unitTranslationDTOSchema),
  releaseUnitIds: t.Array(t.String()),
});

export type WorkMaintenanceDTO = (typeof workMaintenanceDTOSchema)["static"];

export const workMaintenanceParamsSchema = t.Object({
  unitId: t.String(),
});

export const upsertWorkMaintenanceTranslationSchema = t.Object({
  language: languageSchema,
  title: t.Optional(t.String()),
  subtitle: t.Optional(t.Nullable(t.String())),
  summary: t.Optional(t.Nullable(t.String())),
  description: t.Optional(t.Any()),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
});

export type UpsertWorkMaintenanceTranslationInput =
  (typeof upsertWorkMaintenanceTranslationSchema)["static"];
