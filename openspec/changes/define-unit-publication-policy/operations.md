# Unit Publication Policy Operations

## Unit license backfill

Migration `20260518160000_add_unit_publication_metadata` adds nullable Unit
publication fields and backfills existing publishable Units to
`all-rights-reserved`.

This backfill is only for the new Unit publication license. Existing
Book/Game/Media `isLicensed` data is a separate licensed-work/catalog flag and
is not migrated or interpreted as a publication license.

## Search cleanup

After deployment, run a content and post search resync, or delete stale content
documents before normal sync resumes. The sync code now deletes ineligible
documents when a single Unit/Post is private, deleted, draft, archived, or
otherwise not public eligible.

Recommended cleanup:

```bash
bun --filter=@rezics/server run prisma:generate
bun --filter=@rezics/server run prisma:migrate
bun --filter=@rezics/server run resync:content
bun --filter=@rezics/server run resync:posts
```

If the exact resync scripts differ in an environment, run the equivalent
Meilisearch full content and post reindex jobs.

