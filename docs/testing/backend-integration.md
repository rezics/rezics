# Integrated backend qualification

This specification closes [G4](../plan/backend-acceptance.md). Run cases incrementally as module dependencies become available. All results pin the tested commit, schema/contract versions, fixture/data digests, runtime/settings and exact commands.

## Combined scenarios

| Journey | Required interaction |
| --- | --- |
| Cross-source catalog | Several providers and a human describe one native object; conflicting updates, same-value confirmation, withdrawal/reapply and export preserve every authority. |
| Book and media | Create a metadata-only virtual Work, adopt official/community multilingual content, then publish/read/collect/comment; external editions, anthology/part identities, covers and structure changes preserve exact selection and progress. |
| Common Unit capabilities | Use generic Tag, relationship, favorite, follow/discussion and access contracts across owners; the native target, feature scope and authorization survive an owner's logical table-layout change. |
| Graph and Wiki | Native character relations plus story-specific alternatives feed a bounded Graph API and serialized Block query; context/privacy/provenance remain intact. |
| Wiki subsite composition | Azur Lane/Minecraft wiki articles are organized into one or several Collections; separate mod/project Collections can share a Zone portal or have their own Zones. Realm membership/publication context, Collection curation and Zone page infrastructure retain separate authority and identities. |
| Hub catalog | Package/Prompt/MCP metadata links native software, documents and assets; version and source updates do not execute content or expose credentials. |
| Identity and collaboration | Several private operators share Entities, join Org/Realm groups and use custom roles under scoped representation; ordinary defaults never retarget prepared commands or consents. |
| Connected applications | A third-party local account connects an Entity and an Org installs the same App; user and autonomous REST/MCP access retain separate ceilings, private subjects and live dependencies. |
| Revocation | Revoke ownership/delegation/disclosure during import, edit, graph traversal, export or rendition creation; successful commits obey the authority fence. |
| Erasure | Erase an account, image or sensitive literal across revisions, adopted content, messages, notifications, search and caches; replay/restore cannot resurrect it. |
| Jobs | Crash after commit before ACK, lose a lease, change binding/generation and retry; one effective mutation and resumable bounded progress. |
| Correction | Merge/split/reclassify identities with conflicting source/structure/permission state; retain original evidence and explicit ambiguity. |
| Projection recovery | Fail second recommendation/search generation; continue serving last valid generation while repairing and reconciling current authority. |

## System operation sequences

These sequences are pending target acceptance, not claims that the existing module fixtures already compose correctly.

| Case | Sequence and required outcome |
| --- | --- |
| SYS01 | Observe an external update, adopt a native change and publish a new selection as separate operations; only their corresponding events/projections change. Repeat across textual, musical, audiovisual and software scopes. |
| SYS02 | Build a mixed composition with repeated content, stage an import, make a local edit, propose a source refresh and resolve its conflict; retained occurrence identities, published history and user progress stay meaningful. |
| SYS03 | Revoke source/target authority during planning, activation, search or export; no stale grant, cached snippet, label or count exposes private content. An authorized exact disclosure grant is checked independently of container visibility. |
| SYS04 | Crash after a chunk or activation commit before acknowledgement, expire the worker lease and redeliver; durable receipts prevent duplicate effects and old workers cannot activate a generation. |
| SYS05 | Correct identity or change physical layout while shared features reference it; historical refs, grants, votes and source correspondence retain explicit meaning. Restore with erasure/revocation frontiers before reads resume. |
| SYS06 | Mix large imports, native edits, source ingest, queries, votes and notification delivery under skew; measure query/metric work, WAL, locks, queues and freshness rather than infer system capacity from one microbenchmark. |
| SYS07 | Change group ancestry, role head and representation while a delegated content/account-management command waits; validate the complete current proof without pooling unrelated actor/Entity powers. |
| SYS08 | Connect an Entity, install an App, approve a narrower resource scope, then revoke consent/installation while a tool call, refresh and webhook are pending; no subsequent effect may use the revoked path. |
| SYS09 | An operator creates a durable institutional role assignment and dependent execution grant, then leaves; only dependent paths fail. Erasure and restore preserve other controllers without exposing the private account graph. |

Run [WORK01-WORK18](native-work.md), [COMP01-COMP24](content-composition.md) and [Unit capability cases](foundation.md#unit-capability-contract-acceptance) within these sequences. The generated cross-domain TSV remains a separate reproducible inventory; these authored matrices add qualification obligations without pretending to be executed scenarios.

## Verification methods

Run the [identity/access and App matrices](identity-and-access.md) within these
sequences, not only as isolated authentication tests. Protocol privacy, audience
binding and a valid signature do not replace current domain authorization.

For [wiki composition](../architecture/realm-collection-zone.md), test one Collection in multiple Zones, multiple Collections in one Zone, Realm wiki-page grouping, explicit "published in" relationships, different adopted revisions, private members in public presentations and removing a Collection placement without deleting content or withdrawing publication elsewhere. Dynamic Collection runtime is optional; if activated, its query changes, computed membership, captures, stale cursors, revocation and cache/job recovery use the separate guide's cases. Stored Collection tests must pass without it.

- Use real PostgreSQL for rejected persisted states and independent concurrent connections. API stateful flows carry IDs from producer responses.
- Exercise current auth roles, blocked operations, source epochs, quotas and admission; never disable them to make a fixture green.
- Run schema replay/rebuild, eager API compilation and generated OpenAPI/SDK checks. Compatibility with old state is not a test objective.
- Test source parsing, native commands, query and semantic export separately, then together. Complete source declaration coverage requires reviewed dispositions, not one successful large import.
- Run the pending [Unit capability cases](foundation.md#unit-capability-contract-acceptance) and [Book virtual-publication cases](book-and-creation.md) before treating older reference or catalog fixtures as evidence for the revised target. Exercise logical owner separation on one PostgreSQL authority; future database splitting is a separate activation.
- For each elected dynamic property filter/sort, verify typed effective-value indexes, scope and source revision, bounded continuation and dense/selective plans. Unknown, conflicted or unadopted content must not become accepted search facts; all-language policy is not a readable-language match.
- Use 500M/3B relation planning and representative local skew/degree/row-width workloads. Preserve EXPLAIN, p95/p99, failures, WAL, locks, queue age, index/TOAST bytes and recovery bounds.
- Verify new-system backup/WAL/object manifests, erasure-frontier replay, consumer checkpoints and projection rebuild. A development reset does not remove recovery requirements for the product being built.

Keep [known failures](known-failures.md) actionable. A small passing run cannot cancel a reproducible crash. Pure models can expose counterexamples but do not prove SQL concurrency or unlimited-scale correctness. Frontend rendering follows backend qualification and its own explicit evidence workflow.
