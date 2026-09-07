# Governed semantic revisions

The shared catalog layer keeps provider-independent facts and contextual relations
on concrete owner identities. Formal release, medium, occurrence and publication
composition remains in its domain owner. Raw source payloads are evidence and do
not become native facts through an unrestricted object wrapper.

A reviewed definition revision determines scalar kind, nullable values, numeric
bounds, integer precision, text length, vocabulary membership and measurement
unit. Structured values declare a bounded parent-before-child grammar. Predicates
declare exact role revisions, endpoint owner/shape alternatives, cardinalities and
allowed qualifier property revisions. Source-specific business vocabularies are
registered explicitly; adding a new value never changes an existing definition's
meaning. Definition changes append revisions under a row lock.

`beginCatalogFact` stages a new immutable value; append commands accept at most
512 nodes and 512 KB. A replacement supplies the stable semantic ID and expected
head version. Sealing publishes a constant-size head only after validation. Old
value trees remain addressable. Relations are bounded commands with at most 128
participants and 64 qualifiers. Their exact immutable IDs are used by source
support and contextual attachments. Same-participant role/target predicates stay
inside one relation instance.

`listCatalogFacts`, `findCatalogRelations`, `readCatalogFactNodes`,
`readCatalogParticipants` and `readCatalogRelationQualifiers` form the canonical
paged query/export path. Spoilers default to zero. Historical traversal requires
the identity creator and still enforces current target visibility. History entries
carry exact fact/relation IDs; restore appends a decision and switches the head,
without copying or loading the value tree. Withdrawn heads and historical revisions
whose source support has been entirely revoked cannot silently reactivate.

## Workload and capacity

Definitions are bounded control documents: at most 128 grammar rules, 32 predicate
roles, 64 qualifier definitions and 512 members per small controlled vocabulary,
with a 256 KB serialized budget. Large taxonomies are native concept identities
and relations, never expanded into this control document. No process caches the
whole registry. Each command loads only its exact revision and bounded referenced
vocabularies. Class/vocabulary target and slot validation prevents an unrelated
vocabulary from being used as a native field definition.

Corpus-scale facts, values, relations, participants, supports and history are
budgeted separately. For a relation with 3 participants, 2 support records and
4 historical decisions, 500 million relations imply 1.5 billion participants,
1 billion supports and 2 billion decisions; at 3 billion relations those become
9 billion, 6 billion and 12 billion. A rough planning allowance of 160 bytes per
fact/relation header, 96 per value node, 176 per participant, 144 per support,
128 per decision and 64 per head excludes variable text and TOAST. At 500 million
rows these are respectively 80/48/88/72/64/32 GB of heap; at 3 billion they are
480/288/528/432/384/192 GB. Provision indexes separately at 40–80 bytes per entry
per index, plus page slack and WAL; a three-index relation therefore adds roughly
60–120 GB at 500 million or 360–720 GB at 3 billion rows. These are estimates,
not measurements of this deployment.

Owner-first composite keys support `(owner_id, semantic_id, version)` history and
`(owner_id, fact_id, position)` value pages. Reverse participant partial indexes
retain target lookup without scanning all owners. At 500 million or 3 billion
rows, each owner module may partition by an owner-ID hash without changing key
semantics; read routing must locate one partition from that key. An object with
1 million value nodes takes 1,954 maximum-size append commands and 10,000 pages
at a 100-row page size. A restore still switches one head. No corpus-wide closure,
revision snapshot copy, registry refresh rewrite or descendant materialization
runs on the request path.

Writes currently serialize on the owning identity row to retain its revision CAS.
If measured lock wait exceeds the owning service's latency budget (initial
operational alert: p95 lock wait 100 ms or admission queue 1,000 requests), apply
bounded per-owner admission and split independent child version tokens before
increasing write concurrency. This slice does not claim a throughput benchmark.
Relation sealing examines at most 128 participants and 64 qualifiers; generic
relations must not represent a million-member formal composition in one row.

The W3C SHACL model informed the distinction between datatype, cardinality,
vocabulary and node-shape validation; the implementation is a relational native
contract rather than an RDF store: https://www.w3.org/TR/shacl/.

## Verification

`definitions.test.ts` tests governance failures including wrong targets,
cardinality, explicit nulls, invalid measurement values, vocabulary mismatch,
integer precision and ambiguous grammars. `check-catalog-semantics.ts` exercises
staging, immutable rows, current heads, historical values, restore, withdrawal,
spoiler filtering and predicate constraints on an explicitly selected disposable
loopback database, rolling back every fixture. Schema SQL remains a generated
migration input; apply the integration migration before running that fixture.
