import { FederatedSearchOptionsSchema } from "@rezics/contract";
import { Elysia } from "elysia";
import { resolveSlugRef, resolveSlugRefs } from "../../shared/slug-ref";
import { searchClient } from "../search-client";
import { federatedSearch } from "./federated.service";
import type { FilterContext } from "./filters";

// ANCHOR: POST /meili/search/federated
// Single federated entry point for `SearchScope × SearchCategory × SearchQuery`.
// The route validates the body, resolves SlugRef inputs to unitIds, then
// delegates to `federatedSearch`.

export const federatedSearchApi = new Elysia({ prefix: "/meili" }).post(
  "/search/federated",
  async ({ body }) => {
    const ctx: FilterContext = {};
    if (body.query.tags?.length) {
      ctx.resolvedTagIds = await resolveSlugRefs(body.query.tags);
    }
    if (body.query.realm) {
      ctx.resolvedRealmId = await resolveSlugRef(body.query.realm);
    }
    return federatedSearch(searchClient, body, ctx);
  },
  {
    body: FederatedSearchOptionsSchema,
    detail: {
      summary: "Federated search across content, posts, realms, users",
      description:
        "Single endpoint replacing /content/search, /posts/search, /realms/search, /users/search. Accepts SearchScope (route-derived) × SearchCategory × SearchQuery.",
      tags: ["Meili", "Search"],
    },
  },
);
