import type { InfraBootstrapResponse } from "@rezics/contract";
import { Elysia } from "elysia";
import { getDefaultRealmId } from "./default-realm";
import { getSeedTagsSnapshot } from "./seed-tags";
import { getSlugScopesSnapshot } from "./slug-scopes";

export const infraApi = new Elysia({ prefix: "/infra" }).get(
  "/bootstrap",
  (): InfraBootstrapResponse => {
    const seedTags = getSeedTagsSnapshot();
    const defaultRealmId = getDefaultRealmId();
    const slugScopes = getSlugScopesSnapshot();
    return {
      seedTags,
      slugScopes,
      ...(defaultRealmId ? { defaultRealmId } : {}),
    };
  },
  {
    detail: {
      summary: "Infra bootstrap",
      description:
        "Return resolved unitIds for seed tags and the default realm. Sourced from server-side startup caches.",
      tags: ["Infra"],
    },
  },
);

export default infraApi;
