import { FederatedSearchOptionsSchema } from "@rezics/contract";
import { Elysia } from "elysia";
import { tryResolveIdentity } from "@/middleware/permission";
import {
  deriveAllowedRatings,
  intersectRatings,
} from "@/user/service/allowed-ratings";
import { resolveSlugRef, resolveSlugRefs } from "../../shared/slug-ref";
import { searchClient } from "../search-client";
import { federatedSearch } from "./federated.service";
import type { FilterContext } from "./filters";

// ANCHOR: POST /meili/search/federated
// ANCHOR: POST /meili/search/federated（联邦搜索接口）
// Single federated entry point for `SearchScope × SearchCategory × SearchQuery`.
// The route validates the body, resolves SlugRef inputs to unitIds, then
// delegates to `federatedSearch`.
// `SearchScope × SearchCategory × SearchQuery` 的单一联合入口。
// 该路由校验请求体，将 SlugRef 输入解析为 unitId，然后委托给 `federatedSearch`。

export const federatedSearchApi = new Elysia({ prefix: "/meili" }).post(
  "/search/federated",
  async ({ body, headers }) => {
    const ctx: FilterContext = {};
    if (body.query.tags?.length) {
      ctx.resolvedTagIds = await resolveSlugRefs(body.query.tags);
    }
    if (body.query.realm) {
      ctx.resolvedRealmId = await resolveSlugRef(body.query.realm);
    }
    const identity = await tryResolveIdentity(
      (headers as Record<string, string | undefined>)["authorization"],
      (headers as Record<string, string | undefined>)["cookie"],
    );
    const allowed = await deriveAllowedRatings(identity?.userId ?? null);
    ctx.allowedRatings = intersectRatings(allowed, body.query.ratings);
    ctx.viewerUserId = identity?.userId ?? null;
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
