# Wiki Collection composition

`task services-main:db:wiki-composition:check` runs
[the native fixture](../../services/main/scripts/check-wiki-collection-composition.ts)
on an installed disposable Atlas database. It builds native Wiki articles, a
Realm publication context, two stored Collections and two Zones with actual page
and Collection block execution. It retains fixture actors only in that disposable
target. [Pinned evidence](database/wiki-composition-evidence.json) records 35
assertions, 12 HTTP requests and two observed target-authority races.

The cases cover one article in multiple Collections, multiple Collections in one
Zone and the same Collection in another Zone. Removing a presentation preserves
curation and the other presentation. Removing membership preserves Realm
publication. Withdrawing Realm publication preserves native articles and their
Collection membership; globally published content remains readable through the
Collection.

Private members are omitted while paging continues through hidden rows. The
continuation conceals the consumed native identity and is bound to its viewer and
membership revision. Actual HTTP reads reject malformed continuations and invalid
selected authority. Membership search/flags do not reveal unreadable targets,
while the curator's authorized private query still works. Exact PostgreSQL
blockers cover a target becoming private before admission and a read grant
expiring while a membership query waits.

The fixture also rejects transaction-client overlap warnings from Collection
block execution. The [cursor tests](../../services/main/src/services/api/collections/items-cursor.test.ts)
cover tampering with each encrypted component, scope changes, maximum positions,
old/truncated/oversized encodings and invalid boundaries.
`task services-main:collections:cursor-runtime:check` verifies Node-to-Bun and
Bun-to-Node exchange plus 10,000 bounded round trips using the
[runtime fixture](../../services/main/scripts/check-collection-cursor-runtime.ts).

This qualifies these stored grouping/presentation and disclosure paths, not the
whole community module. Metadata count policies, adopted versions, other
revocation/history paths, source conversion and capacity require their own gates.
Dynamic Collection runtime is neither implemented nor required by these tests.

Backend tests pass 333 files/1,796 tests; the 70 focused tests and backend
TypeScript pass. OpenAPI and clients were regenerated, with all three SDK
TypeScript checks and web TypeScript passing. The related-post regression passes
55 assertions/23 HTTP requests on its isolated candidate lane. Node 26.8.2 and
Bun 1.4.2 exchange tokens successfully; 10,000 local round trips took about 1.48
seconds. No schema migration or frontend visual change is required.

## Curation and history authority

`task services-main:db:collection-authority:check` runs the
[authority fixture](../../services/main/scripts/check-collection-authority.ts).
The [pinned run](database/collection-authority-evidence.json) passes 29 checks and
22 HTTP requests. Public and ordinary authenticated readers cannot inspect private
curation history; owners and current editors can, consistently with the existing
`canViewHistory` capability. This authority does not disclose private member bodies.

The original API exposed a private member ID in a public history comparison and
committed an item addition after its edit grant expired during a history-lock wait.
Both regressions are rejected. Cases also cover stale Self state across creation,
history, editing and restoration; verified-email write eligibility; history access
without write eligibility; and rule-backed bans on creation, editing and restoration.

Stateful HTTP cases preserve produced revision IDs through additions, stale CAS,
restoration and metadata/status changes. An editor can repeat the existing status
while editing metadata but cannot change it without the status permission. The
concurrency cases verify expiry rollback, reciprocal references between two
Collections and lifecycle-lock ordering during metadata edits.

Backend tests pass 333 files/1,796 tests; 45 focused tests and backend TypeScript
pass. The wiki composition regression retains 35 checks/12 requests/two races.
OpenAPI/SDKs were regenerated; all three SDK and web TypeScript checks pass.
No schema migration is required. The API/UI design guidance is applied by sharing
the existing history-capability policy with server enforcement; no UI capability
or cardinality is reduced to fit a control.
