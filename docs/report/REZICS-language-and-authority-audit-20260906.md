# Language standards, multilingual names, and authority audit

Date: 2026-09-06. Status: planning decisions and implementation requirements; no application changes or production operations performed.

## 1. Decision

REZICS should use canonical **IANA/BCP 47 language tags for catalog facts**, independently of the finite set of translated interfaces. It should preserve independently identified names, editions, translations, and language-availability statements, and attach official-status claims to those particular records through scoped, evidenced relations to the responsible Entity.

Do not add `language.isOfficial`, infer authorization from a source website, or use a locale formatter as the sole authority for persisted linguistic identity. Do not equate an original title, an officially published title, a community-preferred display title, and a search alias.

The maintainer has authorized destructive database migration in this refactor. The proposed contract therefore need not retain the current seven-language storage limit or one-title-per-language model. This authorization does not execute a migration, authorize loss of user data, or decide the eventual production cutover procedure. The migration plan owns those operations separately.

These decisions remove the identified architectural obstacles. No unresolved theoretical or logical blocker was found. Missing evidence about an individual translation becomes an explicit unverified claim, rather than a blocker for catalog ingestion or the whole refactor.

## 2. What the repository actually implements

The concern about nonstandard language identifiers is partly correct, but lowercasing alone is not the principal problem.

| Finding | Current evidence | Consequence |
| --- | --- | --- |
| Main UI locale storage already uses `zh-Hant` and `zh-Hans` | `libraries/i18n/src/locale-contract.ts:1-10` | Preserve this canonical interface contract; do not describe all current values as custom codes. |
| Content localizations are limited to seven base languages | `libraries/i18n/src/locale-contract.ts:51-90`; `services/main/src/services/api/schema/index.ts:44-46,96-116` | A fully translated UI is effectively a prerequisite for storing many metadata languages. Both Chinese scripts collapse to `zh`. |
| One localization row and primary title per Unit/language | `services/main/src/services/database/schema/unit.ts:165-222` | Title, description, authored content, and images share a language slot; two independent titles in the same language cannot both be primary records with independent scope and evidence. |
| Search aliases already have independent IDs and nullable language | `services/main/src/services/database/schema/unit.ts:275-331` | Reuse or evolve this asset. It is explicitly a search-synonym model, not a sufficient official-name/translation record. Its language is still the seven-value enum and its deduplication key omits authority and edition scope. |
| Consumption-language support is already separate from UI locales | `libraries/content-language/src/index.ts:1-16,34-65`; `libraries/content-language/src/index.test.ts:11-18` | Good existing boundary: a Cantonese consumption tag is supported even though no Cantonese UI is shipped. Extend that separation to names and authored metadata. |
| The current parser calls `new Intl.Locale(value).toString()` | `libraries/content-language/src/index.ts:34-65` | It establishes the runtime's Unicode-locale interpretation, not complete IANA validation or preservation of every BCP 47 linguistic distinction. |
| Language-support data is a bounded atomic JSON value and derived reverse table | `services/main/src/services/database/schema/content-language.ts:29-123`; `schema/postgres/content-language-search.sql:1-47` | Useful bounded projection, but no official-status, translation method, release scope, or organization evidence exists on an individual declaration. |
| Persisted consumption values are re-normalized on read | `services/main/src/services/units/content-language-support.ts:54-63,65-78` | A runtime/CLDR change can change returned values without a tracked catalog migration. |
| External links already identify a source Entity | `services/main/src/services/database/schema/unit.ts:448-482` | Source-organization attribution is not wholly absent. The missing part is a revision-specific evidence binding from that source to a particular name, language statement, or authorization claim. |
| Entity has a global `verified` boolean | `services/main/src/services/database/schema/entity.ts:54-70` | Entity verification alone must not imply that every title or translation associated with it is officially authorized. |
| About uses lowercase locale route/content keys and a mapping to canonical HTML language tags | `apps/about/src/i18n/locales.ts:1-35,52-77` | These are case variants of standard tags, not invented languages. Unify the internal locale identity, with URL spelling handled at the route boundary. |
| Some lowercase identifiers belong to provider contracts | `apps/web/features/auth/components/turnstile-widget.tsx:39-41`; `apps/web/features/media/components/avatar-emoji-picker.tsx:25`; `apps/web/features/media/model/avatar-emoji-recents.ts:3` | Keep explicit provider adapters; blindly replacing every lowercase string would break integration contracts. |
| Chinese conversion is a separate display preference | `libraries/i18n/src/locale-contract.ts:97-105`; `apps/web/features/content-language-display/chinese-content-display-context.tsx` | Conversion can remain a presentation operation; it must not manufacture an official translation, source title, or new edition. |

### Search and delivery dependencies

This is not a localized search-and-replace. The current search document physically contains `text_zh`, `text_en`, `text_ja`, `text_ko`, `text_de`, `text_fr`, and `text_es` (`services/main/src/services/database/schema/search.ts:12-74`). The search service selects them through a finite language map (`services/main/src/services/search/service.ts:1808-1823`). Merely changing the TypeScript enum would leave new languages without correct filtering and indexing.

Language also participates in search request hashes (`services/main/src/services/search/service.ts:2271-2280`), localization primary/foreign keys, history slot keys (`schema/history.ts:339`), content metrics (`schema/content-metric.ts:16-37`), profile preferences (`schema/profile-preference.ts:60-80`), registration language (`schema/auth.ts:37`), Realm/vocabulary/aggregate data, filter contracts (`libraries/filter/src/unit.ts:131-164`), generated OpenAPI/SDKs, and authored document references.

The client and server currently resolve ordered preferences rather than treating UI language as the only choice: `apps/web/lib/localization.ts:15-32`, `apps/web/features/seo/model/unit-landing-language-order.ts:10-29`, and `apps/web/features/seo/data/unit-landing-seo.server.ts:68-76`. Preserve a shared implementation and extend its semantics; do not reintroduce separate browser and SSR fallback rules.

### What the previous reports establish and omit

The existing architecture report explicitly distinguishes metadata display language from consumed-content language and fixes reading state to the selected content (`REZICS-动态元信息与渐进扩展架构-20260905.md:296-298`). It requires language-bearing qualifiers, original credit text, evidence, aliases and their effective periods (`:129-132,376-378`), and owner-based storage of language/evidence/history (`:783-863`). These are sound foundations.

The report does **not** specify a canonical language-code policy, independently addressable official-name records, conflicting official translations in one language, or the difference between a source provider and the authority that licensed/published a translation. Its extensible relations can represent these facts, but capability by implication is insufficient for source mapping and acceptance. This audit adds that missing contract without replacing the owner-based architecture.

## 3. Standards findings

BCP 47 identifies language using registered subtags and defined private-use/grandfathered forms. Tags are case-insensitive; conventional spelling uses lowercase language, title-case script, and uppercase region. Thus `zh-hant` and `zh-Hant` identify the same language/script combination. Canonical spelling is still useful for API consistency, keys, and caches. [RFC 5646, sections 2.1.1 and 4.5](https://www.rfc-editor.org/rfc/rfc5646)

The IANA registry is the relevant source for registered subtags and their preferred replacements. The live registry inspected for this audit has `File-Date: 2026-08-08`; it includes `cmn` as Mandarin within the `zh` macrolanguage and `sh` as Serbo-Croatian without a `Preferred-Value` replacing it with Serbian. A content pipeline must preserve distinctions the source actually supplied. [IANA Language Subtag Registry](https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry)

Unicode/CLDR locale canonicalization and likely-subtag operations serve locale processing. Likely-subtag expansion supplies likely defaults; it does not discover the language, writing system, or territory of a catalog object. Therefore neither maximization nor minimization belongs in authoritative catalog ingestion. [Unicode LDML, locale identifiers and likely subtags](https://www.unicode.org/reports/tr35/)

`Intl.Locale` uses the Unicode locale model. Structural acceptance is not an assertion that each language subtag is an assigned IANA value; some valid BCP 47 forms are outside its accepted grammar. [ECMA-402 language-tag operations](https://tc39.es/ecma402/#sec-isstructurallyvalidlanguagetag)

Use a short registered language subtag when it is the appropriate registered representation; do not invent a rule that every language must have two letters. Source-specific ISO 639 identifiers need an explicit conversion table rather than blind truncation. Use a region only when it identifies a real distinction that is known. [W3C two- and three-letter codes](https://www.w3.org/International/questions/qa-lang-2or3), [W3C choosing language tags](https://www.w3.org/International/questions/qa-choosing-language-tags)

Filtering a set and selecting a display fallback are different operations. RFC 4647 provides language ranges and matching algorithms; the application must choose and publish which operation each endpoint performs. [RFC 4647](https://www.rfc-editor.org/rfc/rfc4647)

### Reproducible local runtime observation

A read-only Node probe on 2026-09-06 used Node `v26.5.0`, ICU `78.3`, CLDR `48.0`, and Unicode `17.0`. It did not execute production code or test the deployed runtime. The existing parser uses the same `Intl.Locale(...).toString()` operation, so these observations demonstrate why its stated content-language guarantee needs review.

| Input | `Intl.Locale` result in this runtime | Target catalog handling |
| --- | --- | --- |
| `zh-hant` | `zh-Hant` | Store `zh-Hant`. |
| `cmn` | `zh` | Preserve `cmn`; Mandarin is information worth retaining. |
| `cmn-Hans` | `zh-Hans` | Preserve `cmn-Hans`. |
| `sh` | `sr-Latn` | Preserve `sh` unless source evidence establishes a narrower language. |
| `iw` | `he` | Apply the registry preferred replacement and retain the original source value. |
| `bh` | `bho` | Use the pinned IANA registry replacement, currently `bih`, rather than inheriting runtime alias drift. |
| `i-klingon` | `RangeError` | Accept valid grandfathered input and apply its registered preferred form `tlh`. |
| `zh-cmn` | `RangeError` | Apply registered extlang canonicalization to `cmn`. |
| `x-acme` | `RangeError` | Recognize valid BCP 47 private use; preserve with its source namespace. Public facet admission is a separate policy. |
| `zzzzzz` | Accepted unchanged | Reject as unregistered for a public registered-language fact; preserve unparsed source input for diagnosis. |
| `en_US` | `RangeError` | Reject public BCP 47 input; a documented source adapter may translate the source's underscore syntax to `en-US`. |
| `en-u-ca-gregory` | Accepted unchanged | Treat the calendar extension as a locale preference, not a new consumed language. |

The same runtime expands `zh-Hant` to `zh-Hant-TW`, `zh` to `zh-Hans-CN`, and `und` to `en-Latn-US` with `.maximize()`. Those outputs are unsuitable as newly asserted catalog facts.

## 4. Target language contract

### One standard identifier, several distinct roles

Use one shared, versioned language-standard package (evolve `@rezics/content-language` rather than duplicating parsers). Its catalog canonicalizer applies RFC 5646 syntax, conventional casing, registered preferred replacements, and extlang handling against a pinned IANA snapshot. Its documented policy must distinguish registry canonicalization from optional matching equivalences. Keep source text and mapper/registry versions in observations.

The interface layer may use `Intl` and CLDR for number/date formatting, language names, and matching a browser preference to an available UI. It must not use the resulting locale as a replacement for the original catalog language. Registry upgrades are explicit data-contract releases with a diff and migration, not silent changes caused by a new Node/ICU binary.

| Role | Contract |
| --- | --- |
| UI locale | Finite set of actually translated interfaces; canonical tags; `zh-Hant` remains region-neutral with Taiwan house terminology. |
| Name/text language | Language of the particular string or document revision; full supported BCP 47 vocabulary, independent of UI availability. |
| Original language | Evidenced fact about a particular work/expression/creation scope; may be multiple; not inferred from creator nationality or default title. |
| Consumption language | Available language for text/audio/subtitle/interface on a particular edition, release, expression, or delivery option. |
| Display transformation | A user's script-conversion/transliteration preference; retains source text identity, transformation version, and attribution. |
| Market/territory | Explicit release/distribution scope; never guessed from `zh-Hant`, `en`, a publisher's headquarters, or a UI locale. |
| Official status | A claim about a particular name, translation, document revision, release, or language availability, established through scoped relations. |
| Jurisdiction's official language | A separate relation between a jurisdiction and a language with legal/temporal scope; not needed to label a translated book. |

`null`/omission means no language assertion supplied. `und` means linguistic content whose language is undetermined when that distinction is needed. `zxx` means no linguistic content, not missing data. Prefer an explicit set over `mul` when individual languages are known; preserve `mul` when a source only supplies that aggregate. These are different states, never a shared fallback to English or Chinese. The catalog API may represent all three explicit standard tags without claiming they are normal user-selectable interface locales. [RFC 5646, section 4.1](https://www.rfc-editor.org/rfc/rfc5646)

Private-use tags are valid BCP 47. Keep them with their declaring source/namespace; do not assume that `x-acme` from two unrelated sources has the same semantics. In the first public catalog contract, admit private-use forms to normalized discovery only through a documented namespace mapping. Otherwise retain them as lossless source facts with a clear unmapped state. This is an interoperability policy, not a claim that the syntax is invalid. Do not silently strip private-use or Unicode extensions: reject an inappropriate role or map it explicitly while preserving the source.

The registry is a bounded build artifact, not an online dependency per request and not a table containing every possible tag combination. Pin its source date and checksum; enforce a generous artifact bound such as 50,000 registry records and 10 MB, reviewed if exceeded. Use generated standards data, not hand-maintained lists of world languages. Keep ingress byte/length/batch limits independently of the registry count.

### Matching and presentation

Define independent `exact`, standard language-range, and optional documented macrolanguage/group filters. An exact `zh-Hant` filter must not match generic `zh` as proven Traditional Chinese availability. A broad `zh` range may find script variants; expansion from `zh` to encompassed languages such as `yue` is a separate explicit product filter, not lexical BCP 47 matching or a canonical alias.

For display, preserve priority: explicit request, profile preference, interface fallback, negotiated browser preference, then the object's editorial fallback order. Within a preferred language, choose a name appropriate to the selected edition and territory, then the current accepted preference for that scope. Return chosen language/name ID, original language/tag, fallback reason, and transformation status when relevant. An official title in an unrelated territory must not displace the title of the actual edition the user selected.

Use identical pure resolution logic for browser, API, SSR/SEO, email and exports where their semantics match. Do not make a reader's selected audio/text language depend on UI fallback. Avoid mapping every text to one language family merely to simplify a finite SQL column map.

## 5. Names, translations, and official authority

### Independently identified names

Evolve the alias/name owner into a first-class **named-form record** with stable ID, owner, exact source text, language tag, form kind (title/name/short name/romanization/sort form/search alias), scope, revision, and lifecycle. Keep multiple named forms in the same language. Separate a current display selection from the underlying records. A search-only misspelling does not automatically become a display title.

A compact per-locale presentation row may remain as a projection or editorial document owner, but its title should select a named-form ID; it must not become a second writable copy of the official name. Document translation identity belongs to a document/revision, not merely `(Unit, language)`. For an authored encyclopedia page, distinguish the currently published translation from competing drafts and translations maintained by different groups.

Language tag equivalence does not prove text identity; identical text and language do not prove identical scope or authority. Deduplicate source observations by source identity/revision/path, and attach independent evidence to a shared name only when its scope and meaning actually match. Do not collapse two publishers' same-language editions because the translated title happens to be equal.

### Scoped authority claims

Use the planned assertion/relation/evidence mechanism, with typed target references to the exact name/translation/edition/field/relationship revision. Do not create a parallel blanket verification system. A claim needs:

- The target's stable identity and the revision it concerns; optional edition/channel/territory scope where applicable.
- The claim type: original designation, officially published designation, authorized translation, credited translator, publisher, distributor, or source-reported status. These roles are not interchangeable.
- The asserting source Entity, the asserted authorizing/issuing Entity when known, and the actual submitting actor. These may be three different parties.
- Evidence source record and immutable observation/revision, field path or quoted fragment reference, retrieval time, and the relevant published/effective time when known.
- Assessment state (`unreviewed`, `accepted`, `disputed`, `rejected`) and lifecycle (`active`, `superseded`, `withdrawn`) as separate dimensions, plus the assessment policy/revision and decision event.

W3C PROV separates entities, agents, activities, attribution, derivation and primary-source relations. It provides useful provenance vocabulary; it does not require an RDF database, prove legal authority, or define REZICS acceptance policy. [PROV-O](https://www.w3.org/TR/prov-o/)

Do not require the authorizing Entity to have a registered user account. An unclaimed catalog publisher can still be the subject of a well-evidenced publication relation. Conversely, an authenticated representative or `entity.verified` status does not prove a particular translation was licensed. Public metadata relations never grant platform access permissions.

An incoming source's `official: true` can immediately be preserved as **that source's assertion**. Where no named authority is supplied, keep `assertedAuthorityEntityId` absent. REZICS must not invent a publisher or rights holder to satisfy a non-null column. Display a source-qualified status until the acceptance policy has adequate evidence for a stronger conclusion. This uncertainty does not prevent the item from being searchable.

### Concrete examples

| Situation | Correct result |
| --- | --- |
| A Japanese original and an authorized Korean edition | Preserve Japanese original language; Korean edition has its own text language, name, publisher and authorization evidence. Both original and official facts can be true at their respective scopes. |
| Two authorized `zh-Hant` titles issued by different publishers or in different periods | Keep both names and scopes; select by actual edition. A language-level uniqueness constraint is insufficient. |
| A fan translation later receives authorization | Preserve its creation/method history; append a later authorization claim and effective period. Do not rewrite the original provenance. |
| A machine-assisted translation is officially published | Translation method and authorization are independent facts; being official does not imply human-only translation. |
| A title is converted from Simplified to Traditional for a reader | Show a transformed representation of the source name; do not claim a new publisher-issued title or new Chinese edition. |
| A source withdraws an official-status flag | Withdraw that source's support; retain other independent evidence and history. Re-evaluate the current projection. |
| Organization A publishes a title, database B records it, user C submits it | Relate A as publisher/authority where evidenced, B as observation source, and C as contributor. |

## 6. Source ingestion rules

**VNDB.** Map `olang` to original-language assertions, `titles.lang/title/latin` to named forms, `titles.main` to source display preference, and `titles.official` to source-reported official-status claims. Do not derive all of these from the top-level display title. Release `languages` and machine-translation flags belong to release language availability; release producer roles belong to scoped relations. VNDB's language-level title uniqueness is an upstream limitation, not a limit REZICS must impose when combining several sources. [VNDB Kana API](https://api.vndb.org/kana)

Pin the source's language enumeration/schema and mapper revision. The live `enums.language` response inspected on 2026-09-06 contains `zh`, `zh-Hans`, `zh-Hant`, lowercase `pt-br`/`pt-pt`, **`ck` labelled Cherokee, and `ta` labelled Tagalog**. For this source schema, map `ck` to registered `chr`, `ta` to `tl`, and Portuguese case variants to `pt-BR`/`pt-PT`. Passing source `ta` straight to a BCP 47 parser would silently assert Tamil. Preserve the original source code and mapping revision; these exceptions must never become global aliases (`ta` remains Tamil in the public standard contract). The UTF-8 response checksum observed was SHA-256 `ed583104c58d757e48391c8373ac88b83a8e9ec04b54f3485d6d3625984f175c`. Re-fetch and pin the full source artifact during implementation. [VNDB schema](https://api.vndb.org/kana/schema), [IANA registry](https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry)

**MusicBrainz.** The release language describes the release and track titles; it is not the language of lyrics or audio. Store it as packaging/tracklist metadata, not automatic audio availability. Preserve release status separately from title provenance and recording language. Translate source ISO 639-3 and script identifiers through versioned mappings. [MusicBrainz release definition](https://musicbrainz.org/doc/Release), [MusicBrainz release style](https://musicbrainz.org/doc/Style/Release)

Aliases carry locale/type/primary and other semantics that should survive mapping. An artist credit's exact printed name is evidence for that credit; it is not necessarily a new globally preferred artist name. [MusicBrainz aliases](https://musicbrainz.org/doc/Aliases)

**Bangumi.** Preserve ordered Infobox records and repeated names; the upstream structure contains multiple aliases and named variants. A label such as a second Chinese name does not prove official authorization, language region, or release identity. The mapper may use an explicitly identified script/language key as evidence, but it must retain the original key/value and mapping revision. [Bangumi Infobox schema](https://raw.githubusercontent.com/bangumi/server/master/openapi/components/wiki_v0.yaml)

**User/AI input.** Use the same canonical language and named-form contracts. AI may propose language detection, script identification, translation and entity matching with evidence and uncertainty. It must not overwrite a supplied standard language tag with a likely UI locale or promote translation plausibility into official status. Store model/prompt/policy version and target revision in the review job; invalidate stale conclusions when the relevant source or target changes.

## 7. Implementation sequence and migration impact

1. Freeze the examples and semantic contracts in this audit. Generate a pinned IANA language artifact and source mapping fixtures. Establish separate proofs for syntactically valid input, registry-recognized content tag, role-appropriate input, and source-scoped private use; a string brand alone proves none of these.
2. Add independently identified names and revision-scoped authority evidence in the appropriate domain owner tables. Reuse Unit and Entity identity and the planned assertion/revision system. Replace seven-language restrictions for metadata and document language; keep the finite UI translation list.
3. Import old localization titles as existing editorial names without inventing official/original status. Preserve `zh` when the original script is unknown. Keep existing aliases, votes, history and external-link IDs through explicit mappings. If past normalization erased `cmn` into `zh`, only recover specificity from preserved source evidence; do not infer it from the new parser.
4. Refactor localization/document identity and dependent history/metric/reference keys together. Rework consumption-language facts to carry scope and evidence; keep a compact derived summary for ordinary cards. Do not keep both a writable JSON summary and writable authoritative statements.
5. Replace fixed-language search storage with owner-sharded, language-tagged name/text projections. Keep a separate broad all-name discovery projection if benchmarks justify it. Candidate deduplication returns a Unit once while exposing which original name matched. Preserve permission filtering, spoilers, alias withdrawal and revision watermarks.
6. Normalize API input before hashing, cache keys, idempotency keys, queue serialization and query execution. Version canonicalization/matching and search projections; reject old cursors clearly after a semantic cutover. Regenerate OpenAPI and both generated SDKs through repository workflows, update filter documents and saved search adapters, then update internal clients together.
7. Unify About's locale values with canonical UI tags. Move lowercase/underscore source/provider formats into adapters. Prefer canonical public locale paths for newly generated URLs, and keep exact existing v1 URL spellings as redirects at the routing boundary when changing them. This is address preservation, not duplicate domain identifiers or restoration of pre-v1 contracts. Follow Unit slug addressing independently of localized names.
8. Update SSR, metadata, `lang`, applicable `hreflang`, sitemap entries, emails, persisted preferences and import/export clients. Publish alternate URLs only where real translated page variants exist; translated titles alone do not prove a localized page. Google's supported annotations include explicit Chinese scripts. [Google localized-page guidance](https://developers.google.com/search/docs/specialty/international/localized-versions)
9. Run collision reports and complete deterministic contract/data reconciliation before cutover. Destructive schema changes remain an explicit, reviewed forward migration or new-deployment cutover within the existing v1+ release history. Do not modify previously released SQL or restore pre-v1 adapters.

Ordinary case variants are accepted at input and emitted in one canonical spelling. Registered preferred replacements and narrowly defined source mappings are input/replay rules; they do not create a second preferred stored value. Every mapping collision preserves the original observations and requires a semantic merge decision at the affected record scope. Conflicting records remain separate and usable while that decision is pending.

## 8. Workload and capacity requirements

This audit does not claim measured production capacity. These starting assumptions specify what the implementation must size and test, at both 500,000,000 and 3,000,000,000 rows for each corpus-scale relation.

| Relation / projection | Illustrative heap + ordinary-index bytes per row | 500 million rows | 3 billion rows |
| --- | ---: | ---: | ---: |
| Named-form record, short text | 192 + 96 = 288 | 144 GB | 864 GB |
| Authority/evidence binding, excluding source blobs | 256 + 128 = 384 | 192 GB | 1.152 TB |
| Language/channel/owner reverse projection | 64 + 64 = 128 | 64 GB | 384 GB |

These are planning estimates in decimal units, not physical measurements; exclude long text, TOAST, full-text indexes, history, bloat, WAL, replicas and backups. Two names per object mean twice the named-form row count; four evidence observations per name multiply again. Store raw source snapshots separately by immutable reference, with retention and reconstruction requirements in the ingestion plan. Do not copy each source payload into every claim.

Use owner/domain plus stable owner-ID partition routing; a `zh`/`en` language partition by itself produces hot and uneven shards. Object pages fetch a bounded current-name set and paginate the rest; initial page/batch limits may be 100 reads and 64 changed records per write, but these are request bounds, not global linguistic completeness limits. Do not preallocate rows for every UI language on every object or include every historical name in a synchronous card response.

For interactive acceptance, use [P10's selected targets](../plan/operational-refactor-20260906/10-capacity-and-operations.md): 100 mixed reads/s, 20 foreground writes/s and 50 source objects/s, including a fivefold burst and highly skewed popular works/publishers; server-side p95 of 300 ms for bounded object presentation and 400 ms for admitted language/name search (search p99 1.2 s), with an explicit timeout and degraded-result policy. These are validation targets, not reported outcomes. A change touching a name, evidence and two projections is several row/index writes; measure that amplification and WAL separately from object throughput.

Require selective indexes for owner/name pages and `(languageTag, channel, owner, stable position)` or equivalent workload-specific reverse navigation. Exact language filtering is low-selectivity on large catalogs, so an index alone does not prove a bounded query. Use keyset/rank seeks with selective companion filters, partition pruning, explicit work budgets and background execution for expensive exact queries. Avoid a request-path count of every name in a language.

Source changes should update only affected names/claims and corresponding projection keys. Preserve a no-change fast path; the current consumption-support writer already avoids identical-value rewrites (`services/main/src/services/units/content-language-support.ts:24-28`). Serialize conflicts by target/revision and coalesce repeated work. Do not periodically rebuild all language indexes when one publisher renames a title.

Measure representative short/long titles, many-language works, popular aliases, 1,000-name hot objects, and common-language skew with EXPLAIN/EXPLAIN ANALYZE. Account for primary and reverse index width, name-token duplication, claim history, concurrent ingestion, queue age and maximum statement time. If projected index size or hot-owner latency exceeds budget, split by domain/owner and maintain cross-owner search projections; do not require a corpus-sized in-memory language map or single-index ceiling. Production qualification belongs to the implementation plan.

## 9. Acceptance matrix

| Test | Required outcome |
| --- | --- |
| Mixed case and registered deprecated tags | One canonical output; case-insensitive identity; original input retained in source observations. |
| `cmn`, `yue`, `sh`, grandfathered and extlang examples | Source language distinctions survive; behavior is pinned to the standards artifact, independent of Node/ICU upgrade. |
| Private use, unregistered values, `en_US`, locale extensions | Standards validity and application policy produce distinct diagnostic outcomes; no silent language substitution. |
| VNDB `ta`/`ck` and public BCP 47 `ta` | The pinned VNDB mapper produces `tl`/`chr`; ordinary standard input `ta` still means Tamil. Mapping identity includes source and schema version. |
| `zh`, `zh-Hans`, `zh-Hant`, `zh-TW` | Unknown script stays unknown; no territory inferred; exact/range/group filters have separate documented results. |
| Missing language, `und`, `mul`, `zxx` | Different states survive API, storage, export and replay; none falls back to an asserted English/Chinese fact. |
| Two official names in the same language | Both names, edition/time/authority scopes and evidence survive; display preference does not delete either. |
| Original, authorized translation, fan translation and machine-assisted publication | Origin, method and official status remain orthogonal; scope is visible in API results. |
| Source provider differs from publisher/translator | All roles remain separate; source assertion may exist without a known issuing authority. |
| Source removal and conflicting evidence | Only affected support is withdrawn; surviving evidence and historical decisions remain interpretable. |
| New revision during AI review | Stale review cannot apply to a changed target; idempotent replay does not duplicate names/claims. |
| Organization claim or Entity merge | Metadata relations do not grant account/representative permissions; claimed official status is re-evaluated at its own scope. |
| Title-only localization | No fabricated edition or consumption-language support; no invented localized-page SEO variant. |
| Cross-script conversion and romanization | Display transformation is marked and reversible; source identity and official-status attribution are preserved. |
| Search by original/translated/romanized name | Same Unit can be found through each accepted name; matching name/language and applicable edition are explainable. |
| Browser/SSR/API language fallback and cursor replay | Shared results for equivalent inputs; semantically changed policies invalidate cursors; canonical inputs hash consistently. |
| Existing language/name migration collision | No overwrite; every old localization/alias/history reference has a traceable target or explicitly retained unresolved record. |
| Sparse data and language coverage beyond UI locales | Objects remain ingestible/searchable without creating empty translations or enabling an untranslated interface. |
| Capacity qualification | Skewed workload, row/index/WAL budgets, partition path and bounded recovery verified at required extrapolation baselines. |

Implementation verification must include shared contract/parser tests, API/SDK serialization, database invariants, imports/exports and migration reconciliation, language-aware search and history tests, and affected TypeScript/i18n policy checks. No AI-assisted visual/browser QA is authorized by this audit; frontend acceptance follows the repository's maintainer policy unless separately requested.

## 10. Remaining work classification

- **Decided now:** IANA-based catalog tags; separate UI locales; identified names; orthogonal origin/method/authority; explicit source/issuing organization; revision-specific evidence; no automatic specificity inference; bounded owner-based projections.
- **Implementation choices, not blockers:** select the standards parser/library after fixture evaluation; exact SQL table names follow domain ownership; tune query indexes, limits and queue concurrency from representative measurements; define display tie-breaks within the decided scope rules.
- **Evidence work, not architectural blockers:** evaluate particular imported official-status claims, recover erased language specificity where raw data exists, and inspect all production language/name collisions in the migration rehearsal. Unknown claims retain usable data and explicit uncertainty.
- **Separate later product opportunity:** jurisdiction-level official-language knowledge, richer historical orthographies and specialist transliteration controls. The chosen relation/tag model already permits them; they are not prerequisites for book discovery, reviews, reading history, or VNDB coverage.

No application code, database state, external account, generated SDK, or released migration was changed for this report. Repository evidence was read directly; standards/source documentation was checked online. The local runtime probe is semantic evidence only, not a deployed-runtime or performance acceptance test.
