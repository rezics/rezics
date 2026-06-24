import type { Static } from "elysia";
import { t } from "elysia";

export const TagRefSchema = t.Object({
  slug: t.Optional(t.String()),
  unitId: t.Optional(t.String()),
  name: t.Optional(t.String()),
  source: t.Optional(t.Union([t.Literal("normal"), t.Literal("policy")])),
});

export type TagRef = Static<typeof TagRefSchema>;
