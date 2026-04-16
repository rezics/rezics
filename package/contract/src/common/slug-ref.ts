import { t } from "elysia";
import type { Static } from "elysia";

export const SlugRefSchema = t.Object({
  slug: t.String(),
  unitId: t.Optional(t.String()),
});

export type SlugRef = Static<typeof SlugRefSchema>;
