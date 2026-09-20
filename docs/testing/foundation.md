# Foundation persistence qualification

The [selected identity/access and connected-app cases](identity-and-access.md)
are a separate target matrix. The existing Self-Agent, direct-grant, organization
roster and Realm membership evidence recorded here qualifies its tested code only;
it does not establish mixed grantees, many-to-many representation, OAuth/MCP or
layered GUI acceptance. Preserve these regression records while replacing their
superseded assumptions through the current plan.

The [plan](../plan/README.md) owns module progress. These fixtures qualify individual foundation contracts on a fresh disposable PostgreSQL target; they do not establish all of M01 or the backend acceptance gate.

## Resource capability contract acceptance

These additional cases specify the [logical Resource boundary](../architecture/database/README.md#34-resource-capabilities-across-owner-tables). They are pending executable qualification and are not covered merely by the reference-allocation evidence below. Run them against registered owners within one PostgreSQL authority; no cross-database fixture is required.

| Case | Required behavior |
| --- | --- |
| UNIT01 | Create a metadata-only REZICS Work without a global parent, reference value, Document or publisher edition; first authorized generic use allocates a reusable REF without changing identity. |
| UNIT02 | Apply the same eligible Tag to targets in different owners, collect them and query each feature in both directions; one feature implementation preserves each owner and actor/scope. |
| UNIT03 | Reject incompatible structural capabilities and unauthorized actors independently, even for existing valid refs; classification alone grants neither. |
| UNIT04 | Demonstrate that generic consumer schemas store canonical target values rather than each owner's nullable alternative; adding an owner requires bridge/adapter/applicability changes without per-kind Tag or favorite logic. |
| UNIT05 | Change an owner's internal table layout in an isolated conformance fixture, retaining its logical reference and adapter contract; generic targets, histories and feature queries retain their meaning. No second database or live migration is implied. |
| UNIT06 | Resolve a bounded mixed-owner candidate page by owner batches; private/missing/stale targets follow disclosure rules without a full owner scan or per-item hydration loop. |
| UNIT07 | Preserve exact revision/occurrence citations when Work selections change; owner withdrawal, deletion restrictions, capability retirement and revocation follow their distinct contracts. |
| UNIT08 | Preserve the logical owner and ID across physical table/placement changes; a logical-owner correction follows explicit historical resolution rather than changing the meaning of an existing REF. |
| UNIT09 | Test cross-feature compositions under revocation, deletion and retry, not only individual reference allocators; separate structural eligibility, feature applicability, actor authorization and backend query support. |

Include global, Realm and private Tag scopes, feature-specific duplicate rules, follow/discussion targets, grants and progress. Do not infer completion for a feature from another feature's successful REF conversion. Record schema and behavior evidence separately from these specifications.

## Disposable domain fixture workflow

The [service Taskfile](../../services/main/Taskfile.yml) can retain a fresh installed target for several domain fixtures. With the default migration port:

~~~sh
task services-main:db:fixture:prepare
DATABASE_ADMIN_URL='postgres://postgres:postgres@localhost:5433/rezics_atlas?sslmode=disable' task services-main:db:participation:check
task services-main:db:fixture:stop
~~~

Use the configured `POSTGRES_MIGRATION_LOCAL_PORT` if it differs from 5433. Preparation resets only the Compose `postgres-migration-test` service, validates/replays the preserved baseline and forward migrations, and leaves the database running. It does not qualify domain behavior by itself. This is the same exclusive lane used by migration generation and `db:check`; finish active domain fixtures before resetting it. The application development database is separate. The full `db:check` remains required for changed migrations/canonical SQL and schema-drift verification.

## Canonical reference values

The executable owner is [check-reference-values.ts](../../services/main/scripts/check-reference-values.ts). `task services-main:db:check` installs the preserved baseline plus forward migrations, runs the reference fixture with the other integrity fixtures and checks canonical SQL and Drizzle drift. To repeat just this fixture against an already installed, isolated `rezics_atlas` database, provide its `DATABASE_ADMIN_URL` and run `task services-main:db:references:check`. The script rejects the development port and non-disposable database names. Its rows are disposable; the full replay task removes the container afterwards.

| Case | Assertion |
| --- | --- |
| Independent identity | An owner can exist and be deleted without allocating a reference value. |
| Valid allocation | Allocate/reuse the same value and decode the exact owner/id; unknown value returns null. |
| Invalid targets | Zero or multiple alternatives fail CHECK; every registered missing owner target fails its concrete FK. |
| Uniqueness and immutability | Duplicate target fails; retarget, rekey and delete fail; referenced owner deletion fails. |
| Lifecycle and routing | Visibility edits preserve identity; temporary locator absence does not alter concrete reference resolution. |
| Concurrent allocation | A second connection demonstrably blocks on the first; commit reuses the winner and rollback allows a new value. |
| Stronger isolation | Repeatable read loses with SQLSTATE 40001; a fresh transaction reuses the winner. |
| Delete/admit race | A deletion that holds the concrete owner lock wins; allocation rejects instead of creating a dangling target. |
| Native identity collision | Two owners cannot concurrently admit the same native UUID. |
| Selective queries | Unforced EXPLAIN ANALYZE chooses target uniqueness and value primary-key indexes. |

The SQL projection also resolves a value inserted by its calling data-modifying CTE. Native-ID lookup and candidate-join predicates use the derived native-ID expression index.

Schema tests separately require one restrictive concrete FK and one partial unique index for every registered owner. No bridge FK targets the routing projection. Internal allocation/resolution is not an authorization API: consumer disclosure, revocation, exact revisions and occurrences require their own executable qualification.

Rejected parent deletion asserts `23001` (`restrict_violation`); insertion against a missing target asserts `23503` (`foreign_key_violation`). These are distinct [PostgreSQL error identities](https://www.postgresql.org/docs/18/errcodes-appendix.html), not interchangeable expected results.

## Workload and evidence

The fixture adds 10,000 reference-owner identities derived from MD5 of `reference-value-20260911:` plus integers 1 through 10,000, with UUIDv8 version/variant bits set, and their canonical values. It emits the base Git commit, SHA-256 digests of the actual fixture/allocator/schema/registry/migration-checksum inputs, Node/platform/PostgreSQL settings, EXPLAIN ANALYZE/BUFFERS JSON and measured tuple, heap and index bytes. Source digests identify pre-commit changes rather than implying the base commit includes them. Retain this command output when using the run as acceptance evidence.

The [pinned qualification run](database/reference-values-evidence.json) passed the full fresh database check on PostgreSQL 18.6/Linux, including canonical SQL and schema drift. Its 10,013 identity values averaged 64 tuple bytes, with 712,704 heap bytes and 1,490,944 index bytes in the fresh sample. Both identity point lookups used their expected indexes and three shared buffer hits. These observations do not replace the planning envelope below or establish sustained-load acceptance.

The bridge stores a UUID and 20 nullable concrete target alternatives, exactly one populated. Each row enters its primary-key index, one partial target index and the derived native-ID expression index. Allocation performs at most three selective statements; reuse performs one lookup and zero updates. Lookup complexity is logarithmic in the selected index, with fixed owner-alternative decoding and no graph traversal. Unrelated targets do not share a write lock. Admission of a hot target serializes only competing insertions; bounded caller transaction/statement deadlines handle contention.

The [capacity model](../architecture/database/capacity.md) retains the conservative 112-byte heap plus 216-byte index assumption per identity value: 164 GB at 500,000,000 rows and 984 GB at 3,000,000,000 rows, before its provisioning multiplier. Catalog reference density remains 1.2 values/root. The fixture measures a small fresh sample, not sustained throughput, WAL, bloat, vacuum or restore behavior at either planning scale. Keep the unpartitioned per-target uniqueness contract and the measured-maintenance activation gate in the [architecture](../architecture/database/README.md#32-generic-references-without-a-universal-entity-parent); hash partitioning by value UUID would lose target uniqueness.

## Exact catalog revision values

[check-revision-references.ts](../../services/main/scripts/check-revision-references.ts) runs inside the same disposable fixture and driver connections. It admits named-form and identifier-claim histories for all eight catalog owners, with their complete owner/item/revision keys. The snapshot guards of those histories establish completion before reference admission; Document, asset, association and occurrence families still need their owning contracts and tests.

Cases cover all six incomplete subsets of a composite key, scattered alternatives, multiple complete alternatives, invalid revision ranges, missing/mismatched targets, duplicate exact values, retarget/rekey/delete rejection, item UUID reuse under two parents, retained old revisions after head updates, competing commit/rollback allocations and repeatable-read failure followed by a fresh transaction retry. Exact references can exist without an identity-bridge row; the parent is part of the concrete revision key, not an independently writable cached REF.

The bounded sample adds 10,000 named-form histories under one owner with UUIDv8 keys derived from `revision-reference-20260911:` and sequence numbers, then their exact values. This tests a hot parent with many child keys. The target lookup must choose the complete tuple's partial unique index without forcing planner settings. The existing 112-byte heap/144-byte index planning assumption covers one selected tuple, primary key and null bitmap for the 16 alternatives; retain the independent 500M/3B envelope and the modeled three exact references per catalog root. Record measured widths, index bytes and plans before accepting that estimate for a wider registry. Reads decode one fixed-width reference row, never its potentially large name/identifier payload; consumer batches and disclosure remain separate qualification.

The pinned run's 10,022 exact values averaged 88 tuple bytes, with 966,656 heap bytes and 1,294,336 index bytes. The complete tuple lookup used `revision_reference_reference_named_form_key`. This is evidence for the registered metadata families and sample distribution, not a qualification of all future revision families or retained-corpus workload.

## Selected participation control protocols

`task services-main:db:participation:check` runs [check-participation-authority.ts](../../services/main/scripts/check-participation-authority.ts) against an explicitly supplied disposable `DATABASE_ADMIN_URL`. Email stays in log mode. The fixture uses native domain commands and real PostgreSQL transactions, with a memory archive for controlled source payloads. Its committed dummy identities remain in that isolated target until reset; the larger recovery/source scenario rolls back after its assertions.

| Protocol | Executable evidence |
| --- | --- |
| Self admission | Competing connections produce one self identity/binding; a provider display name equal to a private email stays unpublished. |
| Catalog identity intake | Current self contribution authority admits identities; missing/stale context, actor mismatch, erased accounts, resource/proposal grants and service principals are denied. Approved source scope cannot escape through a new transaction to create a different identity. |
| Delegation and revocation | A protected name edit demonstrably blocks conflicting revocation; after revocation the exact old grant is denied. |
| Attribution and control | Cataloging a person creates no private account binding; absent ambient authority produces the expected catalog denial. |
| Presentation history | Restore selects the exact earlier name revision and summary, including the session's selected presentation. |
| Initial closure and recovery | Account closure removes its binding/PII and suspends an organization losing its final controller; recovery requires current platform authority and does not restore the erased account binding. |
| Exact source approval | Human/service grants bind the approved proposal and native target; allowed native savepoints preserve scope, unrelated targets/transactions are denied, and revocation remains effective. |

The [pinned participation run](database/participation-evidence.json) records source and migration digests, runtime settings and the exact command. This qualifies the listed protocols only. Remaining membership/ownership transitions, generic resource ACL and disclosure fences, full private-data/asset erasure workers and restoration frontiers remain separate work. The catalog resource API fixture separately checks eager route compilation and stateful ordinary/scoped resource behavior; it does not qualify all M01 APIs.

## Favorites reference consumer and private lifecycle

`task services-main:db:private-lifecycle:check` runs
[check-private-account-lifecycle.ts](../../services/main/scripts/check-private-account-lifecycle.ts)
against an explicitly supplied disposable `DATABASE_ADMIN_URL`. The full `db:check`
also runs it after reference qualification. Current entries and private history
reference one immutable value; API targets remain native owner/ID pairs.

| Case | Assertion |
| --- | --- |
| Consumer integrity | Both tables have exactly one target REF FK, no independent native columns, and no duplicate target in history JSON. Missing values, invalid null/delete snapshots, retargeting and premature history deletion fail. |
| Private disclosure | New saves for inaccessible/missing objects share the not-found result and allocate nothing. Saved content stays private to its account; later visibility changes deny refresh and another account's save. |
| Canonical reuse | Two accounts share the same target REF while retaining independent notes and history. Read/list/history do not depend on the locator projection. |
| Concurrent commands | The stale save demonstrably blocks on the winning transaction and then fails CAS; direct grant revocation waits for preview capture; a capture waiting behind a restriction rechecks and is denied. Account closure waits for an admitted save, and closed accounts cannot append another revision. |
| Restoration and erasure | Stored note, preview and order survive restore. Bounded erasure drains multiple history and archive pages, preserves another account and public follows, and retains the shared REF. |
| Bounded reads | Native-ID resolution uses the derived expression index. A 2,000-entry hot-account fixture requires the ordered page query to use the account-position and reference primary-key indexes, without sequential scans. |

The concurrency fixture commits dummy accounts/posts only in the disposable target.
The private lifecycle and query samples roll back. The image archive is an in-memory
implementation with 502 versions/keys; it proves bounded application behavior, not
object-provider or recovery-frontier acceptance. The command emits source/migration
digests, runtime settings, assertion totals, race outcomes and query plans/footprint.
The query sample derives UUIDv8 targets from its generated account ID and integers
1–2,000; each entry contains 200 title, 700 summary and 100 note bytes before JSON
and row overhead. Whole-table heap/index bytes can include other fixture entries.
The [pinned run](database/favorites-evidence.json) records 49 lifecycle assertions and four observed races. Its 2,000-entry sample averaged 1,200 tuple bytes; whole-table heap/index allocation was 2,777,088/344,064 bytes. The 31-row page used 101 shared buffer hits and the two required indexes.

The 2026-09-20 [retained-consumer rerun](database/native-account-org-evidence.json)
passes 50 assertions and the same four observed races after erasure adopts actual
stored session proofs. The fixture explicitly supplies public names and compares
the exact issued grants; the removed `entity.membership` capability is no longer
counted. Its 2,000-entry plan retains both required indexes. These retained
Self/Favorites consumers do not qualify native account onboarding.

Retain the [private workload estimates](../../services/main/src/services/participation/README.md#private-workload-estimates-and-remaining-qualification)
at both 500M and 3B rows; these samples do not qualify sustained load or restoration.

## Current authorization expiry

`task services-main:db:access-expiry:check` runs
[check-access-expiry.ts](../../services/main/scripts/check-access-expiry.ts); `db:check`
also includes it. Direct resource grants, resource restrictions and platform
capabilities are checked before and after their stored expiry inside the same
open transaction. The fixture waits for the database clock and checks both the
transaction-bound authorization decision and the actual preview reader. Expired
grants deny access; expired restrictions stop denying an otherwise public object.

A separate two-connection case holds a platform grant row without changing it,
observes the authorization query blocked on that exact transaction, waits past
expiry, and releases it. The authorization must reject the expired candidate.
The regressions were observed both with transaction-start expiry and with the
post-lock platform recheck omitted; the corrected paths pass 11 assertions in the [pinned run](database/access-expiry-evidence.json).

Transaction cases roll back; the row-lock case commits only dummy fixture
identities/grants in the disposable target. Output records runtime settings and
source/migration digests. These cases qualify time evaluation for the named
paths, not every ancestor-authority fence, API, erasure frontier or restored
snapshot. The [authorization owner](../../services/main/src/services/authorization/README.md)
describes the current-check protocol and bounded additional query cost.

## Private Tag reference consumer

`task services-main:db:account-tags:check` runs
[check-account-tag-references.ts](../../services/main/scripts/check-account-tag-references.ts),
also included in `db:check`. It allocates references for all eight catalog owners,
then exercises the actual private Tag filter and candidate compiler. The fixture
checks native-ID results, account isolation, anonymous behavior, rejected account
selection in Filter input, duplicate/missing references, self-tagging on insert
and update, category-only/content-label rejection, and closure/erasure without
removing another account's relation or the shared reference.

A separate 10,000-row hot-account sample requires the point predicate and a
native-ID condition pushed through the candidate projection to use
`reference_value_native_id_idx` and a private Tag key. Sample UUIDv8 values derive
from the generated account ID and sequence 1–10,000. Queries remain SQL sets;
only bounded results and EXPLAIN/BUFFERS output reach the process. All rows roll
back. A savepoint temporarily drops the projection index for a bounded comparison, records the resulting plan, then restores it by rollback. Source/migration digests and runtime settings accompany the query evidence.

The [Filter owner](../../services/main/src/services/filter/README.md) records the
120-byte heap/240-byte index estimate for private Tag rows, the independent
500M/3B envelope, amplification assumptions and workload targets. This qualifies
reference storage and the named query paths, not all Tag assertion history,
source conformance, feed ranking or corpus-scale throughput.

The [pinned private Tag run](database/account-tags-evidence.json) passed 30 assertions.
Its 10,000-row sample averaged 104 tuple bytes, with 1,130,496 heap bytes and
1,990,656 index bytes for the private relation. The indexed candidate query used
seven shared buffers. Without the projection index, the same query used 302 and
scanned the private Tag and reference tables; the earlier reference fixture adds
to the reference-table sample in this full run. These are small warm-cache query
observations, not throughput claims at either capacity baseline.

## Scoped resource reads

`task services-main:db:read-scopes:check` runs
[check-unit-read-scopes.ts](../../services/main/scripts/check-unit-read-scopes.ts).
The regression originally admitted a root read from a descendant-only grant,
while the root list predicate denied it. The fixture now covers 16 decisions:
root/ancestor/sibling denial, matching descendants, narrower restrictions,
authenticated audiences, anonymous denial, and explicit root/ownership authority.
The [pinned run](database/read-scopes-evidence.json) uses real PostgreSQL and rolls back its rows. Schema/migration changes are not
required for this policy correction.

[The resource API fixture](../../services/main/scripts/check-catalog-resource-api.ts)
creates a private Collection, grants a descendant scope through the governance
API, verifies the recipient receives 404 for full Collection detail and a denied
root access decision, then grants root read access and verifies both endpoints
allow it. All requests use the ID produced by Collection creation. The expanded
fixture passes 181 assertions alongside its 16 native catalog resources.

## Private account names in access configuration

The resource API fixture changes a grant recipient's private Auth name while
keeping its public Agent name. The access-management response must use the
public name and must not contain the private label. The pre-fix response exposed
the private Auth value. The fixture also rejects concurrent-query warnings from
a single PostgreSQL client; snapshot reads now await their shared-client queries.
The [pinned API run](database/access-snapshot-evidence.json) passes 184 assertions. These checks cover the access
snapshot's label and transaction behavior, not all private-data disclosure paths.

## Controlled organization membership

`task services-main:db:membership:check` runs
[check-organization-membership.ts](../../services/main/scripts/check-organization-membership.ts)
on the retained disposable native target. It uses signed sessions, actual HTTP
responses and PostgreSQL writes, with two connections for each revocation order.
The blocking probe identifies the exact expected transaction. The
[native run](database/native-account-org-evidence.json) passes 197 assertions,
including 70 HTTP requests. It creates public identities and the Org through their
native APIs; direct moderator RoleBindings use privileged fixture setup.

Cases cover exact membership-manager authority, separation from publishing,
security and catalog editing, no automatic controller enrollment, separate private
principal/Entity inboxes, public recipient identities, operation-id retries,
duplicate pending conflicts, recipient-only consent,
stale revisions, removal/rejoin/leave history, decline/cancel/expiry terminal
states, and both accept-before-revoke and revoke-before-accept outcomes. Accepted
membership adds no control grants. Private contacts and encrypted selectors do not
disclose Auth IDs; revoked contacts cannot admit. Direct account settings retain
their owner and reject represented selection. Sender erasure preserves another
account's accepted Entity membership; private-principal erasure closes its admission
and scrubs credential evidence while retaining minimal audit anchors. No invitation
email or message is delivered.

The fixture completes erasure for the two accounts whose cleanup it tests; other
dummy actors remain only in the disposable database. The earlier
[76-assertion run](database/membership-evidence.json) applies to the retired
Self/roster contract. Recovery, suspension and pending-capacity fixtures below still
require native reconciliation; their old results do not qualify this checkpoint.
The tested lifecycle protocols do not establish 500M/3B load acceptance.
The [membership owner](../../services/main/src/services/participation/organization-membership.md)
retains the 1,000-pending limits, storage estimates and workload assumptions.

## Native private account erasure

`task services-main:db:native-account-erasure:check` runs
[check-native-account-erasure.ts](../../services/main/scripts/check-native-account-erasure.ts).
The [2026-09-20 evidence](database/native-account-org-evidence.json) records 232
assertions, including six HTTP requests and repeated worker batch bounds. An
unverified private account erases with its own fresh session without creating a
public Self; the worker accepts a null `selfEntityId` and completes all stages.
Represented requests, explicit API-key bearers, rotated credentials and freshness
expiry during an observed account-lock wait are rejected without partial jobs.
Both credential-use/erasure orderings are fenced. Public identity survives;
private Realm admission ends and its consent/notification evidence is scrubbed.
This proves selected native and retained cleanup paths, not all private owners,
external storage providers, recovery frontiers or capacity. The legacy locale
preference route remains a [recorded failure](known-failures.md#main-iam-qualification-after-schema-extraction).

## Membership generation, suspension and recovery expiry

`task services-main:db:membership-recovery:check` runs
[check-membership-recovery.ts](../../services/main/scripts/check-membership-recovery.ts).
It covers suspended/restored recipient and inviter bindings, stale Auth revisions,
last-controller loss, platform-authorized recovery, old invitation rejection
across organization generations and successful acceptance of a fresh invitation.

Three pre-fix checks failed inside an open transaction: an expired controller
still counted, an expired membership-manager grant left an invitation pending,
and an expired platform grant still authorized recovery. These predicates now
use current-statement time. Recovery also rechecks its locked platform grant's
deadline after acquiring the control row. A two-connection case holds that row
past expiry, proves the exact blocker and verifies that no recovery generation
was appended; removing the recheck makes this regression fail.

The [pinned run](database/membership-recovery-evidence.json) passes 20 assertions using native PostgreSQL commands. Transaction-local scenarios
roll back; the control-wait case leaves only dummy fixture actors/control records
in the explicitly disposable target. This does not qualify account-enforcement
suspension, restoration frontiers or load. Pending-admission saturation is covered below.

## Pending membership admission limits

`task services-main:db:membership-capacity:check` runs
[check-membership-capacity.ts](../../services/main/scripts/check-membership-capacity.ts).
The [pinned run](database/membership-capacity-evidence.json) passes 15 assertions:
organization and recipient pending counts stop at 1,000 in both domain commands
and direct SQL; repeats reuse an existing pending invitation at capacity;
cancellation and expiry reclaim slots without reopening terminal identities.
Two independent connections compete for the last organization slot and then the
last recipient slot across different organizations. Each loser demonstrably
waits for the exact winner, rechecks the bound and fails without exceeding 1,000.

Setup uses native account/organization commands and keeps each controller below
its separate grant limit. Dummy setup rows commit only to the disposable database
so the race clients can see them; reset that target to remove them. This proves
admission bounds and reclamation semantics, not 500M/3B throughput or sustained
flood handling. The existing membership storage, keyset and erasure budgets remain.

## Current platform account and session authority

`task services-main:db:platform-user-authority:check` runs
[check-platform-user-authority.ts](../../services/main/scripts/check-platform-user-authority.ts).
The [pinned run](database/platform-user-authority-evidence.json) passes 51 assertions,
including 10 signed-session API requests. The pre-fix service accepted an
account-state command without current operator authority; checking only in the
route left the write transaction unprotected.

The fixture verifies missing/revoked authority, cached prechecks, suspended and
closed operators, revision conflicts, self-disable denial, rule-backed state
changes, restoration and atomic session removal. All three commands lose to a
concurrent grant revocation after waiting for that exact transaction. A target
account lock held past the operator grant's expiry causes denial without a state
write. Reciprocal suspension commands serialize: the first commits and the
waiting operator then observes its suspension. API requests exercise account
state replacement and single/all-session revocation using generated identities.

The account admission lock permits denial-audit foreign-key references; using
`FOR UPDATE` for the operator instead caused the audit write to time out behind
its own denied command. Both authorized and denied paths run on real PostgreSQL.
Dummy accounts and rule-backed records remain only in the disposable target.
This qualifies these administrative protocols, not all membership/contribution
enforcement, Realm authority, restoration or 500M/3B throughput.

## Account enforcement on participation writes

`task services-main:db:account-participation:check` runs
[check-account-participation.ts](../../services/main/scripts/check-account-participation.ts).
The [native authority rerun](database/account-native-participation-evidence.json)
passes 69 assertions, including five signed-session API requests. Native membership
uses stored session proofs and explicit represented subjects; the retained Self
binding does not authorize it. The earlier [68-assertion run](database/account-participation-evidence.json)
applies to its old membership contract. Current native admission checks account
write eligibility for each operator and, at acceptance, the captured inviter.

Cases cover ban/suspension denial for invite, accept, decline, cancel, remove and
leave; read-only inbox/roster access; silence allowing membership while blocking
catalog intake; explicit enforcement reversal; expired and future enforcement.
Both membership and catalog intake run in each transaction order: enforcement
first blocks admission without consuming the invitation, while admission first
holds its account fence until commit and survives later enforcement. Every race
identifies the exact expected blocker; later contributions are denied.

The HTTP sequence issues an enforcement through governance, checks the declared
native `AccessDenied` response and permitted subject inbox read, reverses the
produced enforcement ID, and accepts the original pending invitation with explicit
consent and membership-version preconditions. Native HTTP selection remains fixed
to the invited Entity. Scenario transactions
roll back; race/API actors and first-party rule setup remain only in the
explicitly disposable database. No external invitation or message is delivered.

The same fixture covers current Favorites reads, lists and history after account
suspension/closure; denied save/delete/restore during a ban; private read access
under enforcement; silence permitting saved-content edits; and restoration
preserving Favorites revisions. The pre-fix service accepted an update during
an active ban. Favorites now checks current account state after its account and
binding locks and applies the account write policy to mutations. Independent
connections exercise enforcement-first and Favorite-first commit orders without
losing a previously committed entry. Account suspension revokes its session; the
fixture rejects that exact old proof both before and after account restoration.
A newly authenticated session can accept when the invitation and representation
remain valid. Restoring sign-in state never restores a revoked credential.

This qualifies the tested account-state and enforcement paths, separate from
binding recovery, Realm membership and whole restoration-frontier coverage. The membership owner records added query demand
under the unchanged 500M/3B workload envelope; this run is not load acceptance.

## Realm membership admission

`task services-main:db:realm-membership:check` runs
[check-realm-membership.ts](../../services/main/scripts/check-realm-membership.ts).
The [2026-09-20 native run](database/realm-native-enrollment-evidence.json) passes
187 assertions including 132 actual HTTP requests. Public identities come from
the native account API; domain calls use real session proofs and explicit selected
representations rather than old participation objects. The run covers ordinary
and approval joins, exact rule consent, stable retries and generations, independent
mute/ban retention, private principal admission, scoped contact/invitation renewal,
contact revocation, and denied lifecycle/owner/authority transitions.

Two-connection cases observe the exact blocker for policy, existing/new ban,
required-rule, moderator-binding and ownership changes. The Realm resource fence
now precedes rule/scope/member reads, protecting absent ownership rows as well as
present ones. A waiting old-policy request conflicts and must explicitly retry;
revoked credentials or representation never become current authority. Account
identity creation is exercised through HTTP; direct moderator role/binding setup
uses SQL-admin fixture primitives and does not qualify grant issuance policy.

The earlier [65-assertion / 28-request evidence](database/realm-membership-evidence.json)
qualifies only the old writable-roster/Self contract. Its rule/follow and removed
state semantics are not acceptance for the current explicit consent and independent
enforcement model. The earlier Realm projection fixture's 55 assertions and
six-migration/15,618-statement installation likewise retain their historical scope.
The current [Realm owner](../../services/main/src/services/realms/README.md) defines
native presentation, paging, retention and workload requirements. The roster
checkpoint below qualifies its listed read paths; broader projection, recovery/erasure,
500M/3B and frontend qualification remain open.

## Native Realm rosters and bounded paging

`task services-main:db:realm-roster:check` runs
[check-realm-roster.ts](../../services/main/scripts/check-realm-roster.ts).
The [2026-09-20 native checkpoint](database/realm-native-roster-evidence.json)
passes 433 assertions, including 211 signed-session HTTP requests and repeated
page bounds. The owning public query schema and 22 Realm schema tests agree with
the actual opaque `afterId` contract; retired raw-profile filters/continuations
and caller-supplied page limits are rejected. OpenAPI and all generated transports
regenerate without a wire diff.

Native consent commands create the active/pending presentation cases. The fixture
checks explicit public names/avatars, private account ID/name exclusion, absent
presentation, regional BCP 47 tags, withheld private Entity metadata, ownership,
denied reads and native RoleBinding revocation with the exact observed blocker.
Strict response parsing rejects unexpected fields. Public presentation setup uses
retained Self consumers; representation and manager issuance use privileged
fixture primitives. These do not qualify native account creation or grant policy.

The 10,001-candidate sample contains 10,000 private version-zero enrollment heads
before one admitted public Entity. The inactive heads confer no membership and
contain no fabricated consent. Public traversal advances through 200 empty pages
and returns the tail once on page 201. Each request consumes at most 51 physical
candidates and examines 50; two operational pages return exactly the first 100
private subjects in order through opaque selectors. Cursor tampering and reuse
across Realm, view or session proof fail.

The actual candidate SQL is captured through the database logger and explained
before and after adding this run's 100,000 background heads. Both plans use
`realm_enrollment_pkey`, return 51 candidate/lookahead rows and have no Sort; the
final plan uses six shared buffer hits. No planner flags force an index. The
reused disposable target retains prior attempts, so these observations are not
clean-database latency comparisons. Inactive-head skew does not qualify heavy
consent payloads, admission throughput, restoration or the 500M/3B workload.

The earlier [46-assertion run](database/realm-roster-evidence.json) qualifies only
its old writable-roster and raw-profile cursor implementation. Retained frontend
G5, recovery and complete Realm acceptance remain open. The
[Realm owner](../../services/main/src/services/realms/README.md#disclosure-and-retained-consumers)
retains current disclosure, paging and workload requirements.

## Public reviewed merge reference fixture

`task services-main:db:reference-merge:check` runs
[check-reference-merge.ts](../../services/main/scripts/check-reference-merge.ts),
using [the shared reference fixture](../../services/main/scripts/reference-merge-fixture.ts).
It creates a real public native pair, a rule-backed request and two independent
reviewers, then claims its operation and executes canonicalization. The redirect
is validated through the normal request/review/archive constraints; no constraints
or triggers are disabled. All fixture rows and the admitted operation roll back.

The pre-fix path emitted a PostgreSQL client warning from concurrent queries in
manifest and request snapshots. These queries now await their shared client
sequentially. The [pinned run](database/reference-merge-evidence.json) succeeds
with zero concurrent-client warnings. This public slice supplies valid merged
anchors for reference-consumer tests; it does not close the separate private
manifest, full reconciliation or recovery scopes qualified in the following sections.

## Private recommendation exclusion references

`task services-main:db:recommendation-references:check` runs
[check-recommendation-references.ts](../../services/main/scripts/check-recommendation-references.ts)
and passes in the full fresh database check: seven migrations, 15,738 SQL
statements, canonical SQL/constraint checks, healthy indexes and no schema drift. The [pinned run](database/recommendation-exclusions-evidence.json)
passes 46 assertions, including seven signed-session requests and actual feed
eligibility before exclusion, after exclusion and after removal. Its cases cover eight catalog
owners, duplicate/missing references, native-anchor retention, shared references,
account isolation, idempotent events, denied-target allocation, removal and account
erasure. A real reviewed public merge supplies the redirect used to test both
ordinary and same-statement reference rejection for a merged target.

The fixture also exercises signed-session exclusion/removal, invalid tracking,
native-ID addressing, the actual feed eligibility predicate, and a direct-grant
revocation race. A 10,000-target private set records tuple/index sizes and explains
the native-reference and account/reference probes. The measured point query uses
seven shared buffers; the fixture relation contains 10,010 rows with 72-byte mean
tuples. This supports the owner's 80-byte heap/144-byte index planning allowance
for the measured distribution, without establishing production throughput. Scenario rows and merge jobs
roll back; API/race actors remain only in the disposable target. The
[recommendation owner](../../services/main/src/services/recommendations/README.md)
records the account, reference, lookup and storage contracts. See
[recommendation verification](recommendations.md) for canonical event storage and
generation/lifecycle cases. Cross-module delivery/recovery and 500M/3B load
acceptance remain integration gates.

## Native merge review and reconciliation

`task services-main:db:merge:check` runs
[check-unit-merge-review-policy.ts](../../services/main/scripts/check-unit-merge-review-policy.ts).
The [pinned native run](database/native-merge-evidence.json) passes 136 assertions,
including three signed-session private review requests. The disposable schema
was freshly installed from seven migrations and 15,738 statements. Each attempt
uses new identities and requires no unfinished jobs at entry; completed history
is retained, and every admitted operation finishes by the end of the run.

Cases cover independent human reviews, service/self/duplicate rejection, exact
fingerprints and revisions, native owner/shape/status/visibility/rating guards,
source preservation, more than 128 reconciliation items, default copy/rebind and
alternate retain/pause plans, and retained-source disclosure. Exact two-connection
barriers prove that binding drift becomes an actionable item. Human retention
and retry require the current binding revision. A manual correction committed
before inventory remains untouched; one committed after inventory can be retained
but cannot be moved back by retry. Explicit operation retry completes settlement.

`task services-main:db:private-merge-review:check` runs
[check-private-merge-review.ts](../../services/main/scripts/check-private-merge-review.ts).
The [pinned private run](database/private-merge-review-evidence.json) passes 20 assertions covering explicit
per-side read grants, denied missing/incomplete/wrong-target/wrong-principal/stale/
revoked selections, two accepted independent reviews, retained-source point and
SQL-predicate agreement, and expiry while waiting on the other side's grant.
A review capability alone never grants private catalog access. Fixture transaction
cases roll back; the expiry-wait accounts remain only in the disposable database.

Pre-fix failures exposed private-pair admission without a way to select both read
grants, source-only authority bypassing the canonical target audience, and domain
reconciliation codes being mistaken for SQLSTATEs. The same change qualifies
explicit manual correction to a third native target while automatic rebinding
remains constrained to the canonical target. Backend tests pass 333 files/1,790
tests; backend, all three generated SDKs and web TypeScript checks pass.
No schema migration or rendered UI change is part of this repair.

These checks qualify the named admission/disclosure/reconciliation paths.
Further phase crash/restart and production/corpus-scale
capacity remain separate obligations in the [merge owner](../../services/main/src/services/units/merge/README.md)
and M06; they do not establish G4 or complete M01/M06.

## Merge worker rollback, replay and current executor

`task services-main:db:merge-recovery:check` runs
[check-merge-recovery.ts](../../services/main/scripts/check-merge-recovery.ts).
The [pinned run](database/merge-recovery-evidence.json) passes 109 assertions.
A fixture-owned Node worker writes a real structure reconciliation page and emits
its barrier before being killed with SIGKILL, before the worker transaction COMMIT. The parent
observes unchanged items/counters/cursors, expires that exact fixture lease and
claims a different token. The stale token cannot apply; the new token applies
one receipt. Replaying the committed token changes neither operation nor counters,
and repeated finalization cannot repeat its graph-lock cleanup.

The crash barrier intercepts only the actual worker connection's COMMIT, preserving
the behavior of any independent database calls. The fixture also revokes a queued executor's capability, suspends/closes its
account through rule-backed commands and advances its Self revision. Three exact
worker/blocker PID races commit account or binding changes while finalization
waits. Each denied execution retains its graph locks and remains actionable;
restoring authority and explicitly retrying completes it. The pre-fix suspended
executor incorrectly reached `completed` through the broad-capability shortcut.

This qualification covers structure-page process loss, lease reclaim, replay and
finalization authority. Other phase crash points and backup/restore remain open. The fixture keeps only its generated data
on the disposable target and refuses other runnable work at entry.

The 136-assertion native merge fixture passes again with these executor checks;
backend tests pass 333 files/1,790 tests and backend TypeScript passes.

## Reviewer receipts and canonicalization authority

`task services-main:db:merge-review-application:check` runs
[check-merge-review-application.ts](../../services/main/scripts/check-merge-review-application.ts).
The [pinned run](database/merge-review-application-evidence.json) passes 137 assertions
on eight installed migrations and 15,848 statements. It checks restrictive private
grant FKs, complete positive revision pairs, correct human authority, immutable
receipts, and rejection of revoked/expired capabilities, inactive/stale Self
bindings, suspended/closed accounts and revoked/expired private read grants.

The pre-fix worker archived a source even after a reviewer lost permission.
Canonicalization now rechecks the stored reviewer context and exact material
access, then checks all selected grant deadlines in one statement after waits.
Five exact-PID deadline races cover an earlier review capability, explicit/private
base read grants, proposer-only expiry and simultaneous proposer/reviewer expiry
while the last private grant blocks. Unused base grants cannot invalidate explicit
pair selections; used base grants remain fenced. Another race
proves a reviewer-capability revocation waits for an already admitted canonicalization.
A superseded request cannot be retried; a new proposal with new reviews succeeds.
Proposer-only expiry remains actionable, and consumed reviews do not undo a
committed resolution when reviewer access later changes.

Transaction scenarios roll back. The separate deadline/revocation races retain
only fixture accounts and terminal request history on the disposable target.
Native samples measure 196-byte Self-authority values, 288-byte contexts with a
base grant, 356-byte public review rows, 408-byte private rows and 496-byte private
rows with a base grant. The maximum numeric form of the current human authority
shape measures 302 bytes. The [merge owner](../../services/main/src/services/units/merge/README.md#reviewer-authority-at-canonicalization)
records the 500M/3B allowances, private-review sensitivity and remaining capacity
qualification. The schema is a fresh-install target; old review records without
these receipts are not converted by this program.

The full database check passed canonical SQL, integrity validation, healthy indexes
and schema-drift comparison on eight migrations/15,848 statements, including the
initial 124-assertion application suite. The expanded 137-assertion suite then
passed on another fresh installation. Native merge (136), private review (20)
and worker recovery (109) regressions passed; backend tests passed 333 files/1,790
tests and backend TypeScript passed. This qualifies the reviewer boundary, not G4
or complete merge/split/disaster recovery.

## Native merge phase recovery

`task services-main:db:merge-phase-recovery:check` runs
[check-merge-phase-recovery.ts](../../services/main/scripts/check-merge-phase-recovery.ts).
The [pinned run](database/merge-phase-recovery-evidence.json) passes 58 assertions.
The child is killed immediately before its actual worker COMMIT; the harness
preserves independent transaction behavior instead of routing all calls through
an ambient rollback wrapper.

For canonicalization, name copying and source rebinding, whole-effect snapshots
remain identical after the crash. These include identities, revisions, immutable
change history, names, redirects, request/operation state and reconciliation items.
Binding snapshots additionally include correspondence history, current projection,
subscriptions, transport outbox and reserved storage credits. Reclaim applies one
archive/name/binding transition; old-token replay changes nothing. Each operation
finishes and releases its graph locks. A crash followed by reviewer revocation
cannot archive the source when the lease is reclaimed.

This closes the named process-crash cases. Backup/restore, whole-system event
recovery and 500M/3B workload qualification remain separate requirements.

The 109-assertion structure/authority regression also passes with the native COMMIT
barrier, and backend TypeScript passes. No production schema or runtime change is
part of this phase-recovery qualification.

## Following current authority

`task services-main:db:following-authority:check` runs
[check-following-authority.ts](../../services/main/scripts/check-following-authority.ts)
on an installed disposable Atlas target. The [pinned run](database/following-authority-evidence.json)
passes 61 assertions and 13 HTTP requests. Cases exercise all six personal Following
operations with stale Self authority and suspended/closed account states. Current
Self restoration permits reads again; another account's authorization cannot be
substituted. Rule-backed bans/suspensions block writes, while silence distinguishes
new public follows from private settings/presentation/removal.

Exact-PID waits cover a Self revision change, target visibility change, a private
read grant expiring while a setting update waits, and a scheduled account ban
starting while a presentation update waits. Rejected operations preserve their
prior state. An account may still edit/remove its own choice after target access
expires when its account policy permits those private actions.

Actual signed HTTP requests cover follow/status/list/settings/presentation/removal,
unauthenticated access, owner-shape mismatch, session revocation on suspension/closure,
and a new session after account restoration. API
schemas and generated clients expose the current authority errors. Transaction
cases roll back; race and HTTP actors remain only in the disposable database.
The separate private-lifecycle fixture checks the existing empty filtered page,
continuation through 512 hidden choices, account isolation and erasure behavior.
This qualifies these authority boundaries, not all notification/block races,
reference normalization or corpus-scale capacity.

Backend tests pass 332 files/1,787 tests; the 31 Following tests pass after the
final rechecks. Backend, all three SDKs and web TypeScript pass after OpenAPI
generation. The private-lifecycle regression passes 49 assertions and four races.
No schema migration is required.

## Canonical Following references

`task services-main:db:following-references:check` runs
[check-following-references.ts](../../services/main/scripts/check-following-references.ts)
on the disposable native schema. The [fresh-layout run](database/following-reference-evidence.json)
passes 61 assertions. It covers all eight catalog identity owners,
shared public/private references, replay counters, missing targets, duplicate
relations, wrong-account preferences, immutable preference ownership and native
self-follow rejection. A reference UUID equal to the follower Agent UUID can
still name a different native target. A same-statement allocation must be visible
to the counter trigger.

The fixture checks tied private cursor positions, exact cursor fields, idempotent
Zone defaults, private followed-Tag selection, retained original references after
a real reviewed merge, forbidden new merged-source follows, removal and actual
account erasure. A 10,000-pair sample records tuple/index sizes and natural plans
for private keyset and native reverse lookups. Insertion and removal while routing
is fenced prove that counters derive from canonical references rather than silently
skipping effects. All fixture data rolls back.

The migration overlay removes the dependent preference FK before replacing the
public Follow key; PostgreSQL rejects the generator's unqualified parent-first
order. The removed Zone capacity command targeted the retired global Resource/Agent
schema and could not qualify this native layout. Native Zone composition capacity
scenarios remain explicit work in M09. Reference integrity and these point/keyset
checks do not establish complete delivery, restore or corpus-scale acceptance.

The installed layout measured approximately 80 bytes per public Follow tuple and
112 bytes per short-position preference tuple. Relation/index sizes in the evidence
include the run's other fixture rows and rollback pages; they are not per-row
production storage estimates. Natural keyset and reverse lookup plans use their
indexes, and the keyset query requires no Sort after matching the index's explicit
null ordering. The authority regression passes 61 assertions/13 HTTP requests and
the private-lifecycle regression passes 50 assertions on canonical targets.

The full fresh database check installs ten migrations and 16,113 SQL statements,
passes canonical SQL/constraint checks, reports healthy indexes and finds no schema
drift. Backend tests pass 332 files/1,788 tests; the affected 95 deterministic tests,
backend TypeScript and unchanged OpenAPI/generated-contract checks also pass.

## Studio visit authority

`task services-main:db:studio-visits:check` runs
[check-studio-visit-authority.ts](../../services/main/scripts/check-studio-visit-authority.ts)
on an installed disposable Atlas target. The [pinned run](database/studio-visit-authority-evidence.json)
passes 39 assertions and 11 signed/anonymous HTTP requests. It checks repeated
visits, private account ownership while an organization is selected, substituted
accounts/Self identities, stale Self revisions, suspended/closed accounts,
restoration and rule-backed ban/suspension/silence policy.

Five observed PostgreSQL blocker pairs cover concurrent Self revision and target
privacy changes, private read expiry during a visit-row wait, a scheduled ban
starting during that wait, and visit time evaluated after the wait. Rejected
writes retain the earlier timestamp. A stored future timestamp is never replaced
by a smaller clock value. Actual requests verify returned native IDs/timestamps,
account isolation, unknown/private targets, session revocation/restoration and
typed restriction errors. Transaction cases roll back; race/request actors remain
only in the disposable target.

The [owning contract](../../services/main/src/services/studio/native-workspace.md#private-visit-authority)
separates private visit metadata from editor eligibility and listing order.
These authority checks do not establish reference normalization, all Studio
listing disclosure paths or corpus-scale throughput.

Backend tests pass 332 files/1,788 tests. After the selected-organization correction,
20 focused tests and backend TypeScript pass. OpenAPI generation, all three SDK
TypeScript checks and web TypeScript pass. No schema change is required.

## Canonical Studio visits

`task services-main:db:studio-visit-references:check` runs
[check-studio-visit-references.ts](../../services/main/scripts/check-studio-visit-references.ts).
The [fresh installed-layout evidence](database/studio-visit-reference-evidence.json)
passes 80 assertions across all eight catalog identity owners. Cases cover
allocation after disclosure, missing references/accounts, duplicate pairs, shared
REFs with separate private times, unchanged editor eligibility and source cursors,
bounded listing with native IDs, reviewed merge retention/rejection and actual
account erasure across two nonempty 500-row deletion pages. Erased accounts cannot
recreate private visits. All fixture data rolls back.

A 10,000-pair sample measures approximately 72 bytes per visit tuple and three
indexes. Exact account/REF and native-ID lookups use compound and canonical
expression indexes; recent pagination uses the Auth/recent index without a Sort.
Recorded relation sizes include other runs' rows and rollback pages, so they are
not production per-row estimates. The owner documents separate 500M/3B pair and
shared-reference budgets.

The first layout run exposed 5–6 second creator listings. A query comparison found
1,449 JIT functions in generic permission branches that cannot admit a native
creator candidate. Specializing the `created` source preserved the same nine
candidate identities, order and acceptance values while removing those branches;
current native read/edit decisions remain mandatory. The final fresh fixture's
nine listing calls measured approximately 49–333 ms. These are local samples,
not throughput or all-source capacity acceptance. Other Studio source filters,
mixed-source skew and integrated disclosure remain explicit M09 work.

The full fresh database check installs eleven migrations and 16,241 SQL
statements, passes canonical SQL/integrity checks, reports healthy indexes and
finds no schema drift. The final creator-path fixture was rerun on that installed
layout. The authority regression passes 39 assertions/11 requests/five races.
Backend tests pass 332 files/1,789 tests, with 23 focused tests after creator-path
specialization; backend TypeScript and unchanged OpenAPI/generated contracts pass.

## Progress parent authority

`task services-main:db:progress-authority:check` runs the
[native command fixture](../../services/main/scripts/check-progress-command-authority.ts)
and [stateful HTTP fixture](../../services/main/scripts/check-progress-authority.ts)
serially on an installed disposable Atlas target. The
[pinned evidence](database/progress-authority-evidence.json) contains 24 command
assertions, four observed command races, 14 HTTP assertions and 18 HTTP requests.

Native cases cover verified-email eligibility, account/Self substitution, stale
Self revisions, private ownership with an organization selected, suspended/closed
accounts and rule-backed ban/suspension/silence policy. Exact blockers exercise
Self revision changes and private-parent transitions before admission, a selected
native catalog read grant expiring during a journal wait, and a scheduled ban
starting during that wait. Rejected writes create neither journal entries nor
snapshots. Transaction cases roll back; race actors remain only in the disposable
database.

The original HTTP probe changed Self revision while an admitted request waited
and still received `200` with a new snapshot. The corrected flow observes the
request waiting on its private journal and then the revision change waiting on
the request's Self lock. The admitted write commits before the change. Subsequent
requests use returned journal entry IDs through create/edit/current/delete,
completion, private visibility, whole-journal removal and restoration; anonymous
and invalid participation selections are rejected.

All mutation handlers enter the [owning boundary](../../services/main/src/services/api/progress/README.md).
The fixtures qualify current Auth/Self and parent read authority, not exact
content/structure versions, every child disclosure path, large journals or the
complete creation/reading module. Existing journals and underlying reference
layout remain separate target work; no schema migration is required here.

Backend tests pass 332 files/1,789 tests. The final boundary also passes 22 focused
tests and backend TypeScript. OpenAPI and all three SDKs were regenerated; all
three SDK TypeScript checks and web TypeScript pass.

## Mixed authority registry qualification

`task services-main:db:access-identities:check` runs
[check-access-identities.ts](../../services/main/scripts/check-access-identities.ts)
on an explicitly supplied disposable `DATABASE_ADMIN_URL`. It also runs inside
`db:check` after canonical reference qualification. The [pinned run](database/access-identities-evidence.json) passes 62 assertions.
The full fresh `db:check` also passes, including canonical SQL, integrity fixtures
and Drizzle drift. These registry cases do not qualify membership, mixed grants
or representation paths.

| Registry case | Qualified native behavior |
| --- | --- |
| Typed subject identity | A principal and Agent with the same UUID allocate different immutable values; repeated allocation and exact decoding preserve their types. |
| Canonical scopes | Platform, private account and public resource scopes each reuse one value. Public roots store one REF FK and no per-domain aliases. |
| Invalid storage | Zero/multiple alternatives, unregistered platform roots, missing concrete targets and duplicate mappings fail. |
| Historical meaning | Retarget, rekey and deletion fail. A referenced account cannot be physically removed; a retained erased-principal tombstone keeps its exact private subject identity. |
| No authority side effects | Subject/scope allocation creates no self binding, Agent participation or representation. Consumer authority and disclosure remain separate checks. |
| Concurrent first use | Independent connections demonstrably block; commit reuses the winning subject/scope value and rollback permits a new value. |
| Deletion race | An owner deletion holding the concrete FK lock wins; later subject admission fails without a dangling row. |
| Stronger isolation | An established REPEATABLE READ snapshot loses concurrent scope allocation with `40001`; a fresh transaction reuses the winner. |
| Bounded reads | A 10,000-owner sample selects the subject/account-scope uniqueness indexes without planner hints and reports tuple, heap and index bytes. |

The fixture records source/migration digests, runtime/isolation/durability settings,
storage context and the generated sample seed. `REZICS_ACCESS_IDENTITY_SAMPLE_SEED`
repeats that sample on a fresh target. The [scope owner](../architecture/identity-and-access.md#private-subject-and-scope-values)
records selected semantics; the [capacity owner](../architecture/identity-access-capacity.md#private-registry-cost)
retains the independent 500M/3B estimates and validation limits. Registry integrity
never substitutes for current actor eligibility, structural capability, scoped
authorization, privacy, erasure/recovery or workload acceptance.

## Historical reference-list fixture

This retained measurement describes the earlier bounded Alias/reference layout.
It does not establish lifetime name limits, open-language coverage or the selected
high-degree Resource target. Original implementation identifiers are preserved.

Migration replay and schema reconciliation validate the partial indexes and all
constraints. A disposable PostgreSQL 18.4/PGroonga 4.0.8 fixture used 100,128
Alias rows across 10,001 Resources, including one Resource at the exact 128-row limit.
The 129th row was rejected by `unit_reference_active_limit`.

On that fixture, `EXPLAIN (ANALYZE, BUFFERS)` for the 128-row list used one
bitmap scan of `unit_alias_unit_position_idx`, touched six shared buffers, and
completed in 0.131 ms. The bounded capacity read used the same index and six
buffers, completing in 0.040 ms. The 100,128-row Alias relation occupied 33 MB,
of which the active-position index occupied 9,328 KiB. This evidence validates
the access shape, not the 500-million-row latency estimate; pre-production load
tests must use production row widths, cache pressure, concurrency, and skew.

## Historical integrity audit

The earlier integrity audit recorded the following schema census and repairs.
These counts describe that audited revision, not the current schema or the
Resource target. The recorded null-safety principle remains applicable.

The audit inspected the 163 Drizzle tables and all 317 pre-change `CHECK`
constraints, including nullable operands, discriminated unions, lifecycle
pairs, aggregate equations, timestamps, JSON root shapes, and ordered values.
The resulting schema has 334 checks on 129 tables; the increase is the 17
fractional-position storage ceilings.

No broad class of checks was removed. The retained checks protect persisted
relationships or values that downstream code legitimately treats as proven.
Full Portable Text and other evolvable document vocabularies intentionally
remain outside PostgreSQL. Pagination maxima likewise remain API-only.

Six constraints had real SQL three-valued-logic holes. PostgreSQL accepts a
`CHECK` when its expression is true **or null**, so a nullable comparison such
as `byte_size > 0` does not prove that `byte_size` exists. The repaired
constraints now explicitly prove non-null values for:

- complete Image Object metadata;
- an external Content Structure target URL;
- an authentication email intent locale;
- both sides of a moderation license transition;
- a resolved Unit ownership claim; and
- Font Awesome icon prefix and name values.

These are database checks because each malformed row would invalidate a shared
state assumption for every writer or reader. Regression tests render and
inspect the Drizzle SQL so a future refactor cannot silently reopen the null
path.
