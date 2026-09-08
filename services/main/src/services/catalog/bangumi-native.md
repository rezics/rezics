# Bangumi native update packet

`createBangumiNativeWriter` accepts immutable before/after archived documents for
subject, person, character and episode records. Both receipt contract and bytes
are checked, and the callback verifies the exact proposal snapshot, previous
snapshot, mapping version, owner and shape. It runs offline. A classification
change requires reviewed correspondence rather than changing the native shape.

The shared native named-form journal handles primary and translated names plus
ordered wiki aliases. Stable primary slots retain their native IDs. Alias
correspondence compares complete native values rather than matching positions.
Unchanged source aliases preserve human corrections. Initializers now bind
immutable name occurrences and Program structural history before sealing their
source correspondence, making subsequent review proposals executable.

Program subject counts and episode parent, sort, disc, duration text, parsed
duration, numbering and date fields use the shared structure source journal.
Archive does not observe API-only episode numbering or parsed duration. Human
values in unobserved fields survive updates and compensation. Changing from a
broader API observation to a narrower archive observation remains an explicit
hold in the shared structure interpreter; it does not erase missing fields.
`prepareBangumiProposalDependencies` admits the episode parent from its exact
archived `/subject_id` evidence before scoped proposal execution.

Withdrawal uses the persisted application journal in reverse order. It never
recomputes an inverse from a live provider response. Names, identifier claims and
structures restore their own native identity/history, and independent edits to
a changed component cause a conflict. Fresh correspondence can add native names
without adopting ownership of existing names. Structure targets must already
have their native typed initialization.

The bounded native update work is at most 128 names, one identifier and one
fixed structure per source record. Names are read through owner/source/snapshot
indexes with a 129-row overflow sentinel; proposal journals impose their shared
128-change bound. At 500 million or 3 billion source records these operations
remain record-local indexed reads and writes; this is complexity evidence, not
a throughput benchmark. Existing source partitioning, outbox admission and
bounded runtime batches remain required for corpus operations. Each modified
name adds one immutable revision/occurrence; each modified fixed structure adds
one component revision and application record. Hot individual source records
serialize under their existing binding/native-owner locks.

Qualification: `check-bangumi-source-updates.ts` covers four families, two
apply/withdraw cycles each, exact primary IDs, human alias preservation, native
episode sort restoration and an independently authored episode number. The
2026-09-08 run passed 54 SQL checks in a rolled-back transaction; the older DB62
target needed only a transaction-local copy of the already corrected canonical
structure occurrence guard. Five focused projection tests and eight existing
record tests passed. Full backend TypeScript remains blocked by separately
owned global Unit-consumer removal; this packet has no TypeScript diagnostics.

Remaining work is explicit: entity profile interpretation, summary/date/wiki
native facts, relation/index/member update compensation, reviewed music and
publishing grain refinement, source classification/NSFW updates, and the shared
previous-phase dependency protocol. The complete nine-family archive parser
qualification does not establish those native update capabilities.
