# Native lifecycle administration

Platform lifecycle commands resolve the locator and lock the concrete native owner row. Catalog identities append their owner change ledger; platform resources append their platform revision ledger. Deleting a catalog entry does not delete the Agent or private authentication account of its contributor. Bootstrap resources and identities admitted to participation require their dedicated lifecycle or recovery flow. Restore preserves the identity and restores a previously published resource as archived, never immediately published. Merge locks and redirects continue to block conflicting lifecycle operations.

The public administration contract identifies a stable Resource reference and its
admitted capabilities. Ownership uses the typed authority subject permitted by the
owner policy; public attribution remains an Agent responsibility. The authenticated account is obtained from Authorization inside each transaction and recorded privately in the audit event. Ownership override targets must be active participating Agents with a current human controller; imported catalog subjects do not become access principals merely because they exist.

## Query contract

Administration supports keyset browsing and typed exact lookup through the
[address contract](resource-addressing.md). The request declares UUID or namespace-
slug lookup; the server does not guess from a string's shape. An explicit namespace
is an address scope, not ownership or permission. Invalid, unavailable and denied
results follow the operation's disclosure contract. Deleted resources can be read
only through admitted administration policy. Title discovery is a separate bounded
Search capability.

Browse windows contain at most 500 locator IDs for lifecycle or 250 participation IDs for ownership, before status or controller eligibility filters. A response can therefore be empty while nextCursor remains non-null. Consumers must preserve that cursor. Hydration occurs after candidate selection. Each lifecycle page contains at most 100 resources; ownership pages contain at most 50. No offset paging, whole-corpus name scan, or unrestricted slug scan is used. Controller checks use current participation and explicit representation/grant
paths; they do not reverse-map a public Agent to a unique account. Ownership commands recheck and lock participation before assigning authority.

## Capacity assumptions

The corpus baseline is 500 million locator rows and the planning estimate is 3 billion. At an assumed 96 bytes per locator heap row and 40 bytes per primary-index entry including page overhead, routing alone is approximately 68 GB and 408 GB respectively, excluding WAL, replicas, free-space allowance, owner rows, and additional indexes. These are estimates, not measured sizes. Routing and each concrete owner remain independently partitionable; the endpoint has no in-memory whole-corpus requirement.

At an illustrative 20 administration requests per second, worst-case browsing examines 10,000 candidate IDs per second, with at most 2,000 returned resources. This is a capacity scenario, not a qualified throughput result. Exact lookup performs one unique-address or locator seek and one concrete-owner seek. Browse work is O(log N + C) for the index window plus at most C point reads, where C is capped independently of N. Name previews use the existing selective owner/name indexes. Long names can still hit the global response size limit; that transport guard is not a claim that every worst-case page fits.

Administration should use bounded connection-pool concurrency and queue rejection rather than accumulating transactions. Monitor transaction duration, pool wait, rejected work, owner hot-key lock waits, and response-size failures. A sustained p95 above one second or pool wait above 250 ms is the planning signal to lower page size/concurrency or redesign the owner-local indexes/partitions; these are operational thresholds requiring production calibration. Recurring index rebuilds and title-search maintenance are not introduced. A future moderation title-search feature requires its own incremental projection that includes deleted resources; it must not reuse public discovery visibility or hydrate the entire corpus.

Code-integrity and actual database fixture results are recorded in the operational qualification ledger. This document alone does not qualify capacity or platform frontend acceptance.

## Realm publication moderation

Each Realm publication selects the latest accepted state-changing governance
action, including reversals, using its serialized state revision. Allocate that
revision while holding the exact publication authority lock and bind the action
to its expected prior state. Timestamps and UUID order are browsing keys, not
proof of causal/commit order. Out-of-order projection delivery compares the
accepted revision and cannot move the pointer backward. The pointer proves exact
Realm/resource identity and state effect; license-only and lock-targeting actions
cannot replace the publication-state explanation. Case authority and evidence
remain immutable. This is incremental work, not an all-history scan.

Realm-publication pages use `(unit_id, updated_at DESC, realm_id DESC)` for at most 500 physical candidates, apply filters to that bounded window, and retain a cursor even for empty filtered pages. The response includes at most 100 exact action PK reads. Private Realm labels are hydrated only after the same transaction proves that Realm readable. Relation state remains available to a manager of the published resource; labels may be null.

At 500 million Realm-publication rows the additional pointer is at most 8 GB of UUID payload when all rows are non-null; at 3 billion it is 48 GB, excluding row alignment. Assuming 56 bytes per browse index entry, the added index is approximately 28 GB/168 GB. The sparse pointer index is approximately 20 GB/120 GB at a 100% non-null rate and shrinks with sparsity. Action inserts add one exact row update and at most one old-action PK read. Hot moderation of one publication serializes on that publication; other publications can proceed independently. There is no history-length dependent request cost or recurring recomputation. Fresh installation must qualify the selected revision and pointer constraints; no pre-v1 transfer is required.

The earlier `check-realm-governance-projection.ts` fixture exercises the current
timestamp/ID projection. Its recorded single-session cases do not establish the
new serialized-revision contract. Acceptance must additionally cover two sessions,
inverted begin/commit order, delayed projection delivery and reversal/revocation
races, with exact state-pointer consistency after recovery.

## History consumers

The platform revision feed examines at most 256 revision candidates per request before minor/tag and current visibility filtering. A contributor feed uses its actor/time index. Native catalog history remains owned by the catalog component APIs; native changes are never inserted into an invented global Resource revision. The public contribution-resource projection also consumes at most 256 indexed principal/activity candidates per request, looks up each actual owner, checks current viewer access, and hydrates at most the returned page. It emits resourceOwner and shape, with nullable native name language. Empty filtered pages retain the boundary of the consumed candidate window.

For either a 500-million or 3-billion-row history relation, request memory and native lookups are bounded by 256 candidates, not history size; index depth changes logarithmically. At the planning scenario of 20 requests/second this is at most 5,120 candidate checks/second per endpoint before page hydration. Existing actor/time and participation/time indexes do the selective work; no new full-history aggregate or index is introduced. The limit trades additional sparse-page navigation for predictable work and remains subject to the connection-pool and latency thresholds above. These calculations are not measured throughput evidence.

## Association consent authority

A two-sided proposal records the intended effect, exact source/target references,
selected authority subject, admitted representation basis, expected revisions and
private operator audit. Public responses disclose only authorized consent state.
Acceptance revalidates both sides' current independent authority; a source-created
Agent or an old credential snapshot cannot reconstruct permission.

Prepared intent is not retargeted by changing a default Agent. Grant/account/Group/
Space-capability revocation invalidates dependent authority under the IAM fences.
Retries preserve operation identity and cannot materialize duplicate relations.
Native relation history and attribution retain their actual owner and grain.

Proposal lists use selective source/target keysets, bounded candidate windows and
explicit continuation through filtered pages. Size proposal/history/private audit
and inverse indexes independently at 500M/3B rows; declare byte/degree limits and
measure current-proof work. The [runtime reference](../reference/current-implementation.md)
records the earlier Auth/Self adapter, whose fixtures do not qualify this target.
