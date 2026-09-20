# Content composition, import and publication

This is the shared composition protocol for [native Works and releases](native-work.md), including virtual and actual releases. Domain owners retain their structural rules. Navigation, media timelines and software dependency graphs are not forced into one permissive tree or a universal content table. The [dictionary](data-dictionary.md) owns relation keys; [acceptance](../../testing/content-composition.md) owns required behavior.

## Explicit local composition

Each composition describes its own complete membership and uses. An occurrence has an identity local to its owning structure, parent/order, content target, coverage and any contextual label, number or credit. Content identity is independent of occurrence identity: the same chapter, recording or other content can occur repeatedly without duplicating its body or media bytes.

An anthology containing a book node records all intended child occurrences explicitly in the anthology's structure. Referencing a Work does not expand that Work's current structure at read time. A book, album or other container may have its own independently maintained structure as well. The anthology can differ in order, omissions, numbering, language selection or coverage without editing that source.

An occurrence that only links to another object remains a reference-only navigation entry. Importing that object's structure is an explicit authoring operation. Neither a family relation nor a container node proves that omitted descendants are included. Known-complete, known-empty, incomplete/unknown and metadata-only outcomes are declared; a budget-truncated result is not a complete composition.

Example (the letters name distinct native identities, not storage keys):

```text
Fixed compilation C, structure revision c7
  occurrence c1 -> Work/version A
    occurrence c2 -> chapter content revision a11
    occurrence c3 -> chapter content revision a12
  occurrence c4 -> Work/version B
    occurrence c5 -> chapter content revision b21
```

All occurrences belong to C's structure. They reuse content versions and retain provenance to the source structures. Updating A's current table of contents does not alter c7. Removing c1's subtree does not delete A, its chapters or another compilation's occurrences.

## Membership, navigation and consumption order

Membership records what is included. Navigation records how users browse it. Reading/playback order records how the selected contents are consumed. Their default may be derived from one validated occurrence set, but their meanings are separate. Alternate chapter indexes, nonlinear supplements, track sequences and time ranges can differ without inventing new content identities. Domain contracts state which occurrences participate in progress and measurement.

The selected relational starting point is explicit occurrence rows with parent/order and complete owner/manifest keys. Parent edges in a validated navigation tree must be acyclic and belong to that structure. Semantic relations may contain cycles under their own contracts; malformed/imported cyclic claims can remain evidence but cannot activate as a valid published tree. Tolerant readers still terminate on damaged or older input.

Shared immutable blocks or subtree representations are possible later physical optimizations if they preserve occurrence identity, local overrides and exact snapshots. They are not a reason to introduce implicit follow-latest expansion. [EPUB, IIIF and DITA evidence](design-evidence.md#composition-and-system-operations) supports explicit composition and reusable content; none prescribes REZICS's SQL layout or proves that all referenced structures are slow.

## Authoring and published versions

Work metadata, contributed content, structure drafts, adoption decisions and published selections have independent heads and optimistic version preconditions. A structure declares its content-selection policy:

| Policy | Behavior and intended use |
| --- | --- |
| Follow published | Ordinary chapters reference a Post identity and explicit language/content channel where needed. Resolve the currently eligible published selection in the requested context; never a private editor head or an unaccepted revision. |
| Fixed selection | Reviewed adoption, fixed releases, precise citations and exact artifact compositions bind a sealed manifest to exact content/adoption revisions and compatibility witnesses. Later source edits cannot retarget that selection. |

A chapter occurrence records its Post reference, local parent/order/title/number
and coverage. The Post/Document retains the body, authorship, editing history and
shared interaction identity; chapter eligibility is a capability, not an exclusive
Post kind. Post is the user-facing social Publication with its selected content;
chapter admission validates a readable body/representation rather than treating
every poll, share or asset-only publication as chapter prose. One Post may stand
alone and appear in several Works. Adding/removing a
chapter use does not duplicate its body, create another social utterance, transfer
control, or delete the Post and discussion. Local placement does not grant access.

Ordinary Post publication updates its small published head. It does not create a
new adoption or whole-book content snapshot in every following Work. Structure
edits still have their own history/CAS and generation-bound pagination. Reusing a
Post follows its eligible content, not the current descendants of another Work.
An import's membership/order remains explicit until deliberately refreshed.

Context resolution selects the author-published channel for an ordinary use and
the accepted selection for a reviewed Realm/Pro use. Missing, withdrawn or denied
content is unavailable; never fall back to a draft or general-scope content.
Keep source revision history for audit and recovery independently of whether a
consumer follows the current published head.

Identity references with a declared published-channel policy are sufficient for ordinary chapter reading. Resolve and report the actual revision used by a response or measurement; do not claim a multi-request frozen edition. Where playback, precise selectors, review, a fixed release or export promises exact content, use complete revision/occurrence references. Metadata-only entries may explicitly retain unresolved content.

Correcting metadata, producing a source revision, adopting a contribution and publishing a selection are distinct operations. An explicit subscription may propose or adopt newer content under current policy, but a pinned published selection changes only through a new authorized selection. The previous version remains resolvable subject to current disclosure and erasure rules.

## Import and refresh commands

Provide one shared import protocol with domain adapters, rather than implicit side effects in ordinary node creation. API inputs name the source structure and exact revision, optional selected subtree/coverage, destination structure and expected head, insertion location, operation key and work budgets. Owner-native command paths provide authority; arbitrary client-declared capability flags cannot authorize the operation.

| Phase | Contract |
| --- | --- |
| Plan | Resolve a stable source revision, validate domain compatibility, source access, destination mutation authority, completeness, cycle policy and budgets. Return a bounded preview/continuation and a plan bound to these inputs. |
| Stage | Allocate destination-local occurrences and preserve source revision/occurrence correspondence. Remap parents/order; preserve the selected fixed-reference or published-channel policy and record the source observation. Commit bounded chunks with durable cursors and worker fencing. Staged rows are not public heads. |
| Validate | Check complete membership, required references, counts/digest witnesses and applicable policies. Recheck current authority and destination preconditions; a stale destination produces conflict rather than overwriting intervening work. |
| Activate | Under the destination lock, seal the result, advance its head and commit history, operation receipt and outbox atomically. Ordinary public events describe the completed operation, not each staging row. |
| Resume/cancel | Reuse the operation receipt and cursor. A repeated request does not create more occurrences; cancellation retains the prior active result and gives staged data an explicit cleanup disposition. |

An import copies the explicit descendants in the selected source structure. Following further referenced structures requires an explicit, version-bound expansion plan with depth/node/byte limits. Do not discover them from an unrestricted family graph. Detect expansion cycles along the current source path; globally deduplicating content IDs would incorrectly remove intentional repeated uses.

The source-to-destination correspondence is keyed by import operation and source occurrence/path in the selected revision, with the destination occurrence as its result. Identical content used twice has two mappings. Replays reuse those mappings; two intentionally separate imports may create separate uses.

Refresh compares the previously imported source version, the proposed source version and current destination edits. Preserve retained occurrence IDs when correspondence is established. New source nodes may be added; source removal or changed content that conflicts with local edits remains a conflict/proposal. Local labels/order/coverage are not silently replaced and source contents are never edited as a side effect of destination changes. Refresh activates a new destination revision rather than rebuilding identities wholesale.

Structural parent edges, imported-from provenance and reverse projections can be produced by the command. They do not automatically establish creative identity equality, family membership, officialness, ratings or access grants. A domain semantic relation needs its own validated claim/adoption path.

## Disclosure, history and progress

Plan and activation both use current authority; readers and exports check currently effective disclosure even for an old snapshot. Inclusion in a public container is not an implicit grant to private content. An explicitly authorized disclosure grant can permit an exact adoption according to its scope. Withdrawing a source or one use is distinct from revoking that grant or erasing the payload.

Do not silently omit unreadable/missing required members and publish the remainder as complete. Return an authorized unavailable/conflict outcome or explicitly declare partial contents without leaking hidden identities, counts or labels. Local title capture itself needs disclosure authority; imports cannot turn private metadata into a public local override.

Ordinary reading progress records account, Work/structure, stable chapter
occurrence and status. A reorder retains that occurrence and does not reset read
status; removing/replacing a target reports a missing/changed position rather than
silently pointing to a different chapter. Completion calculated against current
membership may change when new chapters are added, without erasing recorded reads.
An optional last-read content revision supports an updated-content indicator.
Precise in-body bookmarks/annotations retain the observed revision and selector;
relocation must be validated or reported unresolved. Fixed-edition progress also
identifies its selection. Importing a subtree imports no other account's progress.
Container withdrawal does not draft independently owned children.

## Measurements and read models

Each measurement identifies exact content revision, language/channel, coverage, algorithm and counting basis. Distinguish occurrence-weighted totals from distinct-content totals; avoid adding a container subtotal and its explicit child totals twice. Header/label/reference-only nodes do not acquire body weight merely because their target has a length. Unknown and inapplicable values are not zero.

For fixed compositions, summarize the pinned versions. For ordinary live chapters, summarize the context-eligible published versions actually observed by the projection and expose freshness; never count drafts. Batch changes schedule at most the necessary coalesced work per destination/generation; use validated deltas when available or resumable recomputation otherwise. Do not perform a complete aggregate delete/reinsert for every inserted node. Reverse impact planning pages over relevant active uses/subscriptions, rather than assuming a small permanent reuse limit or scanning all historical placements synchronously.

Search indexes content with its native/version provenance. Composition membership supplies the context and occurrence of a hit. Do not concatenate all descendant bodies into every ancestor by default. Any elected container-level text projection budgets duplication, refresh and disclosure explicitly. Relationship discovery and inferred Tag summaries remain distinct from direct facts about the whole Work.

## Capacity and current implementation boundary

Read children with keys such as structure/generation/parent/position/occurrence and stable continuation. A resumable export of live contents captures a consistent structure generation and resolved eligible revisions in a bounded capture stage, then streams that fixed input manifest; conflicting capture or unavailable required content is explicit. This per-operation capture does not require permanent whole-book snapshots for ordinary reading. Fetch metadata and authority in bounded owner batches. Retrieving an entire N-node structure necessarily processes its output; paging bounds one request rather than making that total work disappear.

Materializing n imported occurrences performs O(n) logical occurrence writes plus their indexes and bounded validation; body payloads are reused. Across publications, storage follows the sum of occurrences and retained changes, not just the number of distinct content objects. Count provenance maps, fixed manifests where elected, published-head references, reverse indexes, local overrides and job receipts at both 500,000,000 and 3,000,000,000 rows. Budget ordinary Post edits without a mandatory write to every chapter use; invalidate/rebuild affected projections in bounded batches. Compare actual rows, WAL and refresh work before claiming a cost improvement. The [capacity workbook](capacity.md) retains planning scenarios, not measurements for these revised key widths and reuse distributions.

Qualify large/deep/skewed structures, repeated content, widely reused source chapters/tracks, concurrent imports/refreshes, privacy changes and maintenance. A bounded algorithm can still miss latency or storage goals. Physical partitioning and future database placement must retain target uniqueness and reference meaning; no distributed deployment is required now.

The [current service boundary](../../../services/main/src/services/content-structure/native-structure.md) still uses a complete-tree path with 2,048 live nodes and 64 live placements per content identity. The current metrics triggers can recompute an owner for each row change. Keep those protections until paged reads, staged writes, coalesced metrics and recovery are qualified together; do not merely raise constants or remove guards. The new protocol is selected design, not a claim that these APIs already exist.
