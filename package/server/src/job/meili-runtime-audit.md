# Runtime Meilisearch Callsite Audit

Generated for OpenSpec change `introduce-job-runner-sync-infrastructure`.

## Runtime Mutation Callsites To Migrate

- `unit-alias-record/unit-alias.service.ts`: alias patch fanout for content, entity, realm.
- `entity-attribution/entity-attribution.service.ts`: content credit/subject patch.
- `feedback/feedback.service.ts`: feedback sync and resolution patch.
- `user/service/user.service.ts`: user sync/delete/field patch and posts-author fanout.
- `realm/realm.service.ts`: realm sync/metadata/member count, content realm/tag patches, post field patch.
- `book/book.service.ts`: content sync/metadata/delete.
- `subject-attribution/subject-attribution.service.ts`: content subject patch.
- `unit/unit.service.ts`: content sync/metadata/delete.
- `unit/translation.service.ts`: content/realm translation patch and posts-target fanout.
- `post/post.service.ts`: post sync/field patch and content sync.
- `shelf/shelf.service.ts`: contained-unit content patch.
- `tag/tag.service.ts`: content tag patch.
- `entity/entity.service.ts`: entity sync/delete.
- `credit-attribution/credit-attribution.service.ts`: content credit patch.

## Approved Non-Runtime Locations

- `package/server/src/meili/**`: direct wrapper implementations and explicit search/admin APIs.
- `package/server/prisma/**`: seed/factory/local setup flows that intentionally remain direct.
- `*.test.ts`: test mocks and assertions for current behavior; update alongside migration.
- `package/server/src/meili/search/**`: search read support.

## Current Status

The producer boundary exists at `package/server/src/job/job-boundary.ts`, but
runtime mutation callsites above still need to be converted from direct
Meilisearch wrapper calls to `@rezics/job` commands.
