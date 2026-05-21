import type { Static } from "elysia";
import { t } from "elysia";
import { ContentSearchDocumentSchema } from "../meili/content";
import { EntitySearchDocumentSchema } from "../meili/entity";
import { PostSearchDocumentSchema } from "../meili/post";
import { RealmSearchDocumentSchema } from "../meili/realm";
import { UserSearchDocumentSchema } from "../meili/user";
import { SearchQuerySchema } from "../search";
import { SearchCategorySchema, SearchScopeSchema } from "./scope";

// ANCHOR: Federated Search Options

export const FederatedSearchOptionsSchema = t.Object({
  scope: SearchScopeSchema,
  category: SearchCategorySchema,
  query: SearchQuerySchema,
  page: t.Optional(t.Number()),
  hitsPerPage: t.Optional(t.Number()),
});

export type FederatedSearchOptions = Static<
  typeof FederatedSearchOptionsSchema
>;

// ANCHOR: Federated Search Result
// Discriminated on `kind`:
//   - "grouped"  → category === "all": one section per index/post-kind
//   - "ranked"   → category === "mixed": single hits[] from Meilisearch federation
//   - "single"   → any one category: paginated items[] for that category

const FederatedSectionSchema = <T extends ReturnType<typeof t.Object>>(
  itemSchema: T,
) =>
  t.Object({
    totalHits: t.Number(),
    items: t.Array(itemSchema),
    processingTimeMs: t.Number(),
  });

const FederatedGroupedSectionsSchema = t.Object({
  books: t.Optional(FederatedSectionSchema(ContentSearchDocumentSchema)),
  reviews: t.Optional(FederatedSectionSchema(PostSearchDocumentSchema)),
  excerpts: t.Optional(FederatedSectionSchema(PostSearchDocumentSchema)),
  remarks: t.Optional(FederatedSectionSchema(PostSearchDocumentSchema)),
  posts: t.Optional(FederatedSectionSchema(PostSearchDocumentSchema)),
  shelves: t.Optional(FederatedSectionSchema(ContentSearchDocumentSchema)),
  realms: t.Optional(FederatedSectionSchema(RealmSearchDocumentSchema)),
  users: t.Optional(FederatedSectionSchema(UserSearchDocumentSchema)),
  entities: t.Optional(FederatedSectionSchema(EntitySearchDocumentSchema)),
});

export type FederatedGroupedSections = Static<
  typeof FederatedGroupedSectionsSchema
>;

const FederatedOriginSchema = t.Object({
  indexUid: t.String(),
  category: SearchCategorySchema,
});

export type FederatedOrigin = Static<typeof FederatedOriginSchema>;

// A ranked hit is any document shape with an `_origin` discriminator attached
// by the server so the client can render the right card.
const FederatedRankedHitSchema = t.Intersect([
  t.Union([
    ContentSearchDocumentSchema,
    PostSearchDocumentSchema,
    RealmSearchDocumentSchema,
    UserSearchDocumentSchema,
    EntitySearchDocumentSchema,
  ]),
  t.Object({ _origin: FederatedOriginSchema }),
]);

export type FederatedRankedHit = Static<typeof FederatedRankedHitSchema>;

// Items in a single-category response. Concrete narrowing is done client-side
// by branching on `category`.
const FederatedSingleItemSchema = t.Union([
  ContentSearchDocumentSchema,
  PostSearchDocumentSchema,
  RealmSearchDocumentSchema,
  UserSearchDocumentSchema,
  EntitySearchDocumentSchema,
]);

export type FederatedSingleItem = Static<typeof FederatedSingleItemSchema>;

export const FederatedSearchResultSchema = t.Union([
  t.Object({
    kind: t.Literal("grouped"),
    scope: SearchScopeSchema,
    sections: FederatedGroupedSectionsSchema,
  }),
  t.Object({
    kind: t.Literal("ranked"),
    scope: SearchScopeSchema,
    hits: t.Array(FederatedRankedHitSchema),
    totalHits: t.Number(),
    processingTimeMs: t.Number(),
    page: t.Number(),
    hitsPerPage: t.Number(),
  }),
  t.Object({
    kind: t.Literal("single"),
    scope: SearchScopeSchema,
    category: SearchCategorySchema,
    items: t.Array(FederatedSingleItemSchema),
    totalHits: t.Number(),
    processingTimeMs: t.Number(),
    page: t.Number(),
    hitsPerPage: t.Number(),
  }),
]);

export type FederatedSearchResult = Static<typeof FederatedSearchResultSchema>;
