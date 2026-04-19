import { t } from "elysia";
import { SEED_TAG_NAMES, type SeedTagName } from "./seed-tags";

export const infraBootstrapResponseSchema = t.Object({
  seedTags: t.Partial(
    t.Object(
      Object.fromEntries(SEED_TAG_NAMES.map((name) => [name, t.String()])) as {
        [K in SeedTagName]: ReturnType<typeof t.String>;
      },
    ),
  ),
  defaultRealmId: t.Optional(t.String()),
});

export type InfraBootstrapResponse = {
  seedTags: Partial<Record<SeedTagName, string>>;
  defaultRealmId?: string;
};
