# Content composition and operation acceptance

Owners: M01-M05, M07 and M09. Contract: [content composition](../architecture/database/content-composition.md). All cases below are pending executable qualification. Existing full-tree fixtures do not qualify staged import, large structures or cross-domain published snapshots.

| Case | Required behavior |
| --- | --- |
| COMP01 | Include a book/album/container reference without implicit descendant expansion; reference-only navigation remains distinct from composition import. |
| COMP02 | Import a source structure's explicit descendants into destination-local occurrences; retain explicit fixed-reference or published-channel policies and observed provenance without cloning bodies or independent content identities. |
| COMP03 | Repeat the same content and source subtree intentionally; preserve different occurrence IDs, parentage, order, local labels and coverage. |
| COMP04 | Preserve unknown/incomplete, known-empty and metadata-only states; a truncated or filtered source cannot be published as complete by accident. |
| COMP05 | Reject invalid same-manifest parentage and structural cycles at activation; traversal of damaged/evidence input terminates, while permitted semantic-graph cycles remain independent. |
| COMP06 | Pin source revision at plan time and reject a stale destination version; a source's newer head is not silently substituted while staging. |
| COMP07 | Retry the same operation before/after a page commit and after a lost response; reuse mappings and effects. Different intentional imports remain distinct. |
| COMP08 | Stage a result larger than one request budget, restart the worker and resume; readers see the previous active version until complete activation. |
| COMP09 | Revoke source disclosure or destination authority between planning and activation; no unauthorized result or private label snapshot is published. |
| COMP10 | Cancel or lose a lease during import; stale executors cannot write or activate. Preserve prior active contents and a resumable/cleanup disposition. |
| COMP11 | Explicitly expand referenced structures through a version-bound plan; enforce node/depth/byte budgets and path-cycle checks without globally deduplicating repeated content uses. |
| COMP12 | Refresh with unchanged base, changed source and untouched destination; retain established occurrence IDs and map additions/removals exactly. |
| COMP13 | Refresh after local title/order/coverage edits; compare base/source/local state and preserve edits or return conflicts rather than overwrite or recreate every node. |
| COMP14 | Update the source after an anthology/album release is published; its old contents, traversal and measurements remain bound to the original selection. |
| COMP15 | Adopt a newer compatible revision through an authorized policy/command; create a new destination selection without retargeting historic citations. |
| COMP16 | Represent membership, alternate navigation and consumption order separately where required; previous/next lookup is deterministic for repeated occurrences. |
| COMP17 | Check current disclosure on reading/exporting old selections; a public container does not implicitly grant private child access or leak hidden counts/labels. |
| COMP18 | Keep ordinary progress scoped to account/structure/stable occurrence and fixed-edition progress additionally scoped to selection; importing others' structure imports no progress. Refresh maps compatible positions or reports unmapped/unknown. |
| COMP19 | Compare occurrence-weighted and distinct-content metrics; exclude label/reference-only weights and avoid parent-subtotal/leaf double counting. |
| COMP20 | Import many nodes while measuring metric refresh calls/work; coalesced/delta or bounded job processing replaces per-node full-aggregate recomputation. |
| COMP21 | Repeatedly create/remove uses across many owners, then update source content; reverse impact processing is paged and does not treat the live-placement limit as a bound on historical rows. |
| COMP22 | Search a content hit in several authorized publication contexts; retain exact match/occurrence provenance, avoid artificial duplicate relevance and do not concatenate all descendant text into every ancestor by default. |
| COMP23 | Emit canonical completion and downstream work only after activation; no partial-page public notifications or source-observation-as-publication events. |
| COMP24 | Restore database/objects and job cursors, replay duplicate events and apply erasure/revocation frontiers before disclosure; no resurrected payload or duplicate activation. |
| COMP25 | Update a Post used by ordinary chapters; resolve its eligible published head, retain independent occurrence IDs and avoid a new selection write per containing Work. |
| COMP26 | Remove one chapter use without deleting its Post/discussion or another use; draft/private/withdrawn and unaccepted content cannot leak through the parent. |
| COMP27 | Capture live chapter contents for export with a consistent membership generation and exact resolved inputs; concurrent changes cause explicit retry/conflict rather than mixed output. |

## Workload qualification

Exercise ordinary small objects, structures exceeding 2,048 nodes, content reused more than 64 times, deep chains, repeated subtrees, wide siblings and skewed popular content. These are replacement-target tests; do not remove existing protections to make current fixtures pass. Introduce the paged/staged path, metric strategy and recovery tests as a coherent change.

Record total logical nodes versus rows newly written, distinct body bytes versus reused references, local override/source-map widths, index work, metric invocations, WAL, lock time, memory, response bytes, queue age and exact cursor progress. Inspect actual child/reverse query plans. Use fault injection at each durable phase and independent connections for concurrency.

Extend the existing 500,000,000-row baseline and 3,000,000,000-row estimate to occurrences, import correspondence, revisions, projection membership and operation receipts. Model repeated-use and history amplification independently of distinct content. Representative local fixtures inform these estimates but cannot certify full-scale throughput or recovery time. Run [system integration](backend-integration.md), including source, community, authority and delivery behavior, before G4 acceptance.
