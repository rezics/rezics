## Why

Meilisearch currently indexes content (books, games, media, shelves, links), users, and feedbacks — but **posts and realms are completely absent**. This means:

- Post search is impossible — users cannot search reviews, remarks, quotes, or discussions
- Realm search is impossible — users cannot discover realms by name or description
- Frontend list views for posts and realms hit Postgres directly, which is slower and lacks advanced search/filter capabilities

Posts (especially reviews with `PostKind.REVIEW`) are a core engagement feature. Realms are a core organizational feature. Both need to be searchable and both need fast, filterable list endpoints powered by Meilisearch.

Additionally, frontend list views should prefer Meilisearch over direct DB queries for performance and search capability. The DB-backed list endpoints remain for the admin dashboard (require admin role).

## What Changes

- Add a `posts` Meilisearch index with documents denormalized for list rendering (body, author info, target unit info, kind, scores)
- Add a `realms` Meilisearch index with multilingual title/description search and metadata filtering
- Add sync triggers in `post.service` and `realm.service` for incremental updates
- Add full reindex functions (`syncAllPosts`, `syncAllRealms`)
- Add admin API endpoints for init/sync/delete on both new indexes
- Add server-mediated search endpoints: `POST /meili/posts/search`, `POST /meili/realms/search`
- Add contract schemas for post and realm search options/results
- Rewire frontend post and realm list queries to use Meilisearch search endpoints
- Restrict existing DB-backed `GET /posts/` and `GET /realms/` list endpoints to admin role only
- Add admin UI controls for the new indexes in the Meili admin page

## Capabilities

### New Capabilities

- `post-search-index`: Meilisearch index definition, document schema, sync, and search API for posts
- `realm-search-index`: Meilisearch index definition, document schema, sync, and search API for realms
- `meili-frontend-lists`: Frontend list views rewired to use Meilisearch search endpoints instead of DB-backed list APIs

### Modified Capabilities

- `content-search-api`: Add post and realm search endpoints alongside existing content search
- `content-sync`: Add post and realm sync triggers following the same incremental pattern

## Impact

- **`package/search`**: New index definitions in `client.ts`, new document builders and sync functions in `sync.ts`
- **`package/server`**: New search endpoints in `meili.api.ts`, sync calls added to `post.service.ts` and `realm.service.ts`, existing list endpoints restricted to admin
- **`package/contract`**: New schemas for `PostSearchOptions`, `PostSearchDocument`, `RealmSearchOptions`, `RealmSearchDocument`
- **`package/api`**: New search query hooks for posts and realms, existing list queries rewired
- **`package/app`**: List components consume Meilisearch-backed queries
- **`package/admin`**: New index management controls on MeiliPage
