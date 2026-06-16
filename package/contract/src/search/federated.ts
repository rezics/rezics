import type { Static, TSchema } from "elysia";
import { t } from "elysia";
import { CommentSearchDocumentSchema } from "../meili/comment";
import { ContentSearchDocumentSchema } from "../meili/content";
import { EntitySearchDocumentSchema } from "../meili/entity";
import { PostSearchDocumentSchema } from "../meili/post";
import { RealmSearchDocumentSchema } from "../meili/realm";
import { ShelfItemShelfGroupSchema } from "../meili/shelf-item";
import { UserSearchDocumentSchema } from "../meili/user";
import { SearchCategorySchema, SearchScopeSchema } from "./scope";
import { SearchQuerySchema } from "./search";

// ANCHOR: Federated Search Options
// ANCHOR: 联邦搜索选项

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
// ANCHOR: 联邦搜索结果
// Discriminated on `kind`:
//   - "grouped"  → category === "all": one section per index/post-kind
//   - "ranked"   → category === "mixed": single hits[] from Meilisearch federation
//   - "single"   → any one category: paginated items[] for that category
// 以 `kind` 作为判别字段：
//   - "grouped"  → category === "all"：每个索引/post-kind 一个区块
//   - "ranked"   → category === "mixed"：来自 Meilisearch 联邦的单一 hits[]
//   - "single"   → 任一单个 category：该 category 的分页 items[]

const FederatedSectionSchema = <T extends TSchema>(itemSchema: T) =>
  t.Object({
    totalHits: t.Number(),
    items: t.Array(itemSchema),
    processingTimeMs: t.Number(),
  });

const ShelfSearchDocumentSchema = t.Intersect([
  ContentSearchDocumentSchema,
  t.Object({
    matchedShelfItemGroup: t.Optional(ShelfItemShelfGroupSchema),
  }),
]);

const FederatedGroupedSectionsSchema = t.Object({
  books: t.Optional(FederatedSectionSchema(ContentSearchDocumentSchema)),
  reviews: t.Optional(FederatedSectionSchema(PostSearchDocumentSchema)),
  excerpts: t.Optional(FederatedSectionSchema(PostSearchDocumentSchema)),
  remarks: t.Optional(FederatedSectionSchema(PostSearchDocumentSchema)),
  posts: t.Optional(FederatedSectionSchema(PostSearchDocumentSchema)),
  comments: t.Optional(FederatedSectionSchema(CommentSearchDocumentSchema)),
  shelves: t.Optional(FederatedSectionSchema(ShelfSearchDocumentSchema)),
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
// 排名命中是任意文档形态，由服务端附加 `_origin` 判别字段，使客户端能渲染正确的卡片。
const FederatedRankedHitSchema = t.Intersect([
  t.Union([
    ContentSearchDocumentSchema,
    ShelfSearchDocumentSchema,
    PostSearchDocumentSchema,
    CommentSearchDocumentSchema,
    RealmSearchDocumentSchema,
    UserSearchDocumentSchema,
    EntitySearchDocumentSchema,
  ]),
  t.Object({ _origin: FederatedOriginSchema }),
]);

export type FederatedRankedHit = Static<typeof FederatedRankedHitSchema>;

// Items in a single-category response. Concrete narrowing is done client-side
// by branching on `category`.
// 单一 category 响应中的条目。具体的类型收窄在客户端通过对 `category` 分支完成。
const FederatedSingleItemSchema = t.Union([
  ContentSearchDocumentSchema,
  PostSearchDocumentSchema,
  CommentSearchDocumentSchema,
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
