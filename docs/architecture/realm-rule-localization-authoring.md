# Multilingual Realm Rule authoring

## Decision

A Realm Rule is one ordered policy with one or more language-specific
presentations. A Rule revision is still an immutable, complete replacement,
but each submitted Rule now has this shape:

```json
{
  "localizations": [
    { "language": "en", "title": "Be civil", "content": {} },
    { "language": "zh", "title": "保持友善", "content": {} }
  ]
}
```

The shared localization contract requires between one and seven entries, and
the request boundary rejects duplicate language identities. Bilingual text is
never merged into one title or document. The authoring endpoint returns all
localizations, while the public reading endpoint continues to choose one
presentation from the caller's ordered language preferences.

Publishing requires the exact current `baseRevisionId`. An advisory transaction
lock serializes publication within one Realm; after acquiring it, the service
reloads the current revision and returns `RealmRuleRevisionChanged` instead of
replacing a revision based on stale authoring data. Rule array order becomes the
persisted ordinal order, so the web editor's up and down controls require no
separate reorder endpoint.

## Browser draft model

The selected content language is authoring state, not interface-locale state.
Changing the interface language therefore does not select another content
language. Changing the content language is immediate and never asks the user to
discard the current editor.

Every editor draft is identified by account, Unit, feature scope, and either a
content-language partition or a shared partition. Language-specific fields use
separate partitions; fields such as a Zone slug, schedule, theme, or page
placement use one shared partition. Realm Rules use one shared aggregate draft
whose Rule entries each contain a language-keyed localization map. This avoids
both forms of loss: unmounting a keyed language editor does not erase its draft,
and global fields do not fork into contradictory copies per language.

Drafts are retained in memory for immediate switching and in a versioned
IndexedDB object store for reload recovery. Stored values enter application
state only after their feature codec validates the unknown runtime value. A
draft records the server revision used as its baseline; when that baseline no
longer matches, the editor preserves the draft, displays a conflict warning,
and offers an explicit discard action. Successful publication removes only the
submitted draft partition. Stored drafts expire after 30 days when next read.

## Bounded work and capacity

Rule configuration is strictly bounded to 100 Rules per revision and seven
content languages. One maximum-size publication therefore processes at most
700 localization rows and returns at most 700 rows from the authoring endpoint.
The logical write fan-out is at most one revision, 100 Rule Units, 100 ownership
rows, 100 revision membership rows, 700 localizations, one Realm Unit revision,
and one audit event. Search and B-tree index maintenance add write amplification,
but there is no unbounded queue, N+1 read hydration, or corpus scan. Publication
is expected to be a low-rate administrative operation; plan for 10 sustained
publications per second platform-wide and bursts of 100, with connection-pool
backpressure. A single hot Realm is intentionally serialized.

The current revision lookup uses
`realm_rule_revision_realm_published_idx`; its Rules use
`realm_rule_revision_position_idx`; and localization hydration joins by the
`unit_localization` primary key and ordered Unit index. Request work remains
O(700) at both the 500,000,000-row planning baseline and the 3,000,000,000-row
forward estimate. Inserts retain O(log N) index maintenance rather than scanning
historical revisions. Memory and network input are bounded by 700 documents and
the service-wide 128 MiB request ceiling; the same ceiling is configured across
srvx runtimes and applies streaming backpressure. Latency should be measured with
the maximum Rule and localization counts plus representative Portable Text
payloads. Authoring responses contain at most those 700 documents; operators
should alert on responses above 16 MiB and on database-pool waits above 100 ms.

Historical Rule revisions grow with authoring activity, not reader traffic. If
500 million localization rows average 1 KiB of heap, indexes, and content, the
central estimate is roughly 0.5 TiB; three billion rows are roughly 3 TiB before
WAL, replicas, vacuum headroom, and backups. Actual Portable Text size is the
dominant variable and must be measured. Trigger archival or partitioning before
a primary exceeds 2 TiB, sustained I/O exceeds 70%, or maximum-size publication
p95 exceeds 1 second for three consecutive windows. Partition historical
revisions and their Rule Units by stable Realm hash so current-revision reads
remain colocated; keep the current-revision pointer and recent history online.

## 1.5.0 cutover

1. Stop Rule authoring during deployment. Mixed 1.4.0 web/API/client binaries
   are unsupported because their PUT bodies have different meanings.
2. Back up the database. No schema or data rewrite is needed; verify that the
   existing `unit_localization` primary key and ordering indexes are present.
3. Deploy REZICS 1.5.0 API and workers, the generated OpenAPI clients including
   `@rezics/api@1.9.0`, and the 1.5.0 web application as one release.
4. Verify that a current one-language revision loads as a one-element
   `localizations` array, publish a two-language revision, reload both languages,
   and verify the submitted Rule order.
5. Re-enable Rule authoring after API and web release headers both report
   1.5.0.

Rollback requires the complete 1.4.0 binary and client set. Newly published
multilingual rows are readable by the old public fallback endpoint, but the old
authoring UI would overwrite them with one language. Keep Rule authoring
disabled after rollback until 1.5.0 is restored or an operator intentionally
publishes a replacement revision through a multilingual-capable client.
