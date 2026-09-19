# Resource content-language declarations

Status: target contract. [Native values](schema-modeling.md#shared-value-contracts),
[named forms](catalog-names-and-authority.md), [Work](database/native-work.md) and
[composition](database/content-composition.md) own the related but distinct models.
The [runtime reference](../reference/current-implementation.md#routing-and-language)
records current parser, document and metadata limits.

## Meaning and scope

Declared content-language support states which languages and consumption channels
a Resource claims to support. It does not prove that currently readable content
exists, that a subtitle fits a particular cut or that a language pack fits a build.
Metadata language, available representations, contribution policy and actual
published/adopted selections have independent contracts.

An entry has an admitted canonical BCP 47 tag and may name channels such as text,
audio, subtitle or interface. Omitted channels mean language-level knowledge;
an empty channel set is not interchangeable with unknown channels. Preserve source
scope, exact definition/policy, evidence and unknown/withdrawn states. Accepted
declarations are governed facts, not facts manufactured from a UI language list.

A native Work may accept contributions in any admitted language without preallocating
one support row for every language. Publisher identifiers and release language
claims do not constrain the Work's community contribution policy. Conversely, an
open contribution policy does not assert that every language is already available.
Text/translation, subtitle/dub, lyrics, software interface and mixed-media channels
retain their actual grain and compatible content/version references.

## Language identity and presentation

Use the pinned IANA policy. Preserve explicit script/region/variant meaning and
scoped private-use namespaces; source vocabulary conversion precedes native
validation. Do not apply CLDR likely-subtag expansion or infer a lost script.
Unknown/unprovided language, `und`, `mul`, `zxx` and absent requested translation
remain distinct. Locale preference extensions are not automatically native
content-language identity.

The authoring UI can offer common choices, typeahead and relevant existing values;
it must preserve admitted values outside its translated locale list. Content-language
selection and interface-language selection are independent. Normalization,
translation/transliteration and display fallback are different operations. Public
reads report actual selected language and fallback, and never create a translation.

## Storage and history

Use owner-local identified language-support assertions/entries with exact revisions,
scope and accepted selection. Native language identity is not capped at seven or at
the current 64-entry document guard. Bound commands and pages rather than lifetime
language coverage. Large complete replacements use staged manifests and atomic
activation, preserving omitted versus explicitly cleared state.

The target can map small sets to a bounded payload or typed child rows, provided
the binding preserves occurrence/value semantics, complete revision references and
the same operation contract. A physical representation is not permission to truncate
languages. Owner/reference integrity follows the Resource reference contract; there
is no mandatory global parent or independently editable cached owner ID.

Each edit changes only the relevant subaggregate/head. Reads of historical values
use the pinned policy/definition and do not reinterpret them with a newly installed
locale runtime. Registry upgrades classify unchanged, convertible or unsupported
values and preserve original evidence; a change in lookup policy is not an implicit
whole-corpus rewrite.

## Queries and inverse projection

Queries distinguish declared support from localization and actual readable coverage.
Specify exact admitted language identity and optional channel; any macro-language
or fallback expansion is an explicit versioned query policy, not hidden equivalence.
Channel unknown does not prove an exact channel match.

An effective reverse projection keys language/channel/scope/resource and pins the
accepted source revision/generation. A compact channel mask is a storage choice
when its fixed channel vocabulary is appropriate. Subject-local writes and language-
leading discovery need separate access paths; the existence of an index in every
subject partition does not prove bounded global lookup. Recheck current disclosure
and predicate semantics after candidate selection.

Request/cursor identity includes normalized query, language-policy version,
effective language/channel decisions and relevant selection generations. A policy
or preference change cannot reuse an incompatible continuation. Updates maintain
affected entries or enqueue bounded incremental work; they do not delete/reinsert
every language on every small edit.

## Evidence suggestions and adoption

An editor can inspect bounded source/release/version/track evidence. Each suggestion
identifies the source occurrence, scope, language/channel, compatible target and
mapping version. Page with complete source-specific keys and explicit continuation;
do not recursively traverse all structures to construct one authoring response.

Accepting a suggestion is a native command under current authority, expected head
and source/correspondence epochs. Same-value human confirmation is independent
support. Omission is withdrawal only for an explicitly complete authoritative
source fieldset; a partial page or unavailable provider is not negative evidence.
Provider/showcase data never remains a second writer over accepted native values.

## Adapted audio relationships

A video cut, hosted asset, external platform publication and audio representation
are distinct referents. An adapted or alternative audio relationship records the
exact source/target, semantic role, language/channel, timing/coverage compatibility
and applicable revision. Language availability does not imply that two tracks are
interchangeable or licensed for substitution. Repeated occurrences and source
claims retain identity, provenance and acceptance under the shared relation model.

List tracks with bounded keysets; choose a small current playback selection under
its own policy. A selection or command budget is not a lifetime maximum number of
languages, adaptations or audio tracks. Reverse reads need the target-leading
index/projection and current access checks; no whole-video-history hydration.

## Workload and capacity

Let L be supported-language entries per Resource, C declared channels, H changed
revisions/support observations and B the admitted batch/page bound. Storage scales
with actual L, C, H and source/selection density; per-request work follows B and a
bounded authority/selection lookup. Do not derive safety from a fixed seven-language
world or assume every Resource has the same small L.

Apply the independent 500M/3B-row baseline to declarations, revisions, evidence and
reverse entries. At an illustrative 200 bytes per current row including its elected
lookup indexes, one relation alone is 100 GB / 600 GB before replicas, WAL, backups
and free space. Long language/context/source fields and index choices change that
estimate; measure actual widths and multilingual skew before sizing deployment.

The selected deployment stays in one database. Use owner-local keys and elected
language-leading projections, partition only with proven uniqueness/reference
constraints, and bound hot-language/subject work. Observe p95/p99, candidate rows,
buffers, lock/pool waits, WAL, projection lag, vacuum, index rebuild and restore.
Record a concrete same-database response to the limiting resource. Cross-database
sharding, mandatory live dual-write and a fixed shard count are outside this scope.

## Installation and acceptance

Use owning generators and forward migrations; preserve released SQL and the
installation baseline. Development/test rebuilding is permitted by the program.
Do not backfill support from metadata language or tree placement without a reviewed
semantic mapping. Keep current guards until the replacement passes persistence/API
checks; a new document contract does not disable a running constraint.

Verify open-language admission, unknown/channel distinctions, large paginated sets,
staged completeness, exact history, source withdrawal, same-value confirmation,
inverse queries, policy-version cursors, current authority and replay/erasure.
Existing finite-document fixtures remain scoped evidence, not full target acceptance.
