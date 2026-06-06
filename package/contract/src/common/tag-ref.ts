import type { Static } from "elysia";
import { t } from "elysia";

export const TagRefSchema = t.Object({
  slug: t.Optional(t.String()),
  unitId: t.Optional(t.String()),
  name: t.Optional(t.String()),
});

export type TagRef = Static<typeof TagRefSchema>;
