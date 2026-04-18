import type { Static } from "elysia";
import { t } from "elysia";

export const SlugRefSchema = t.Object({
  slug: t.String(),
  unitId: t.Optional(t.String()),
});

export type SlugRef = Static<typeof SlugRefSchema>;
