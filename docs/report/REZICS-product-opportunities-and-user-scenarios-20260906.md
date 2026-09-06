# REZICS product opportunities and operational user scenarios

Date: 2026-09-06. Status: researched product decisions for the operational refactor; not an implementation or production acceptance record.

## 1. Decision and scope

REZICS should operate several concrete product lines around a shared catalog: book search and selection, reviews and ratings, curated book lists, reading history, tag and character discovery, multilingual version discovery, and connected creator/media reference. These are independently useful entry points. They should share identity, provenance, permissions, and reliable user records rather than require every person to complete one prescribed journey.

The launch portfolio should combine two kinds of value:

- Immediate personal or reference utility: find the correct item, distinguish versions and translations, explore credits and relationships, keep reading records, and import or export one's own records. These can work before a large REZICS community exists.
- Community utility: read and write reviews, discover and publish lists, participate in a community's ratings, and correct catalog information. These require deliberate content and contributor development in addition to software.

The strongest initial positioning is a useful book and visual-novel companion with multilingual and cross-media depth. MusicBrainz, VNDB, and Bangumi integration belongs to this refactor; a separate broad music streaming product, publishing marketplace, package registry, GPU catalog, or general social network does not. The architecture should retain their expansion path without presenting their existence as a launch requirement.

The maintainer explicitly permits destructive database migrations for this refactor. Existing production data should not dictate the new product semantics. Migration and cutover remain independently planned work; this report performs no production inspection or mutation. The approximate book/source counts in the conversation are maintainer estimates, not verified inventory.

## 2. Research method and strength of evidence

All web sources below were checked on 2026-09-06. Publisher announcements and official product documentation are primary sources, but self-reported signups and activity are not audited active-user or revenue figures. A competitor's implemented feature establishes a product precedent, not unmet demand for a REZICS copy. None of these sources establishes REZICS product-market fit, willingness to switch, or willingness to pay.

| Evidence | What it supports | What it does not establish |
| --- | --- | --- |
| StoryGraph's official account announced 5 million cumulative signups on 2026-01-30. Its product connects reading records, discovery, lists, and reading groups. [Announcement](https://bsky.app/profile/thestorygraph.com/post/3mdmttgr6qk2m), [product](https://www.thestorygraph.com/) | A substantial audience has tried a newer reading companion alongside established incumbents. Personal tracking is a credible acquisition and retention line. | Five million active users; demand for every advertised feature; REZICS conversion rates. |
| Letterboxd reports 672,527,875 ratings, 332,793,689 diary entries, 143,610,337 reviews, and 12,875,167 lists for 2025. [2025 review](https://letterboxd.com/2025/) | Tracking, evaluation, and curation are separately used behaviors at scale. They should have separate REZICS completion and usage metrics. | Book-market size, unique people, or that film behavior transfers unchanged to books. |
| Booklog's own 2025 first-half ranking announcement says registered membership exceeded 2 million. [Company announcement](https://prtimes.jp/main/html/rd/p/000000007.000132237.html) | Reading management and book discovery have an established Japanese-language audience. | Current monthly active users or demand for a multilingual replacement. |
| Bangumi's live homepage combines books, animation, games, music, people, progress, lists, and discussion; it displays substantial item-level follow activity across these domains. [Bangumi](https://bangumi.tv/) | A Chinese-language cross-media catalog/community model is actively operated. Soundtrack and creator paths fit an existing usage context. | Demand for REZICS, representative conversion, or total active-user counts. Catalog totals are supply, not demand. |
| VNDB's official API exposes work tags, character traits, nested character/work filters, release languages and platforms, official titles/releases, translation flags, and staff/character voice relations. [Kana API](https://api.vndb.org/kana) | A concrete compatibility and discovery benchmark. Character-to-work and language/version queries can be specified precisely. | The market size of Chinese/Japanese/Korean VN users or proof that a translated interface alone is differentiated. |
| Watcha's official 2025 awards notice and ongoing curation magazine demonstrate an operated Korean-language evaluation/curation surface. [Awards](https://pedia.watcha.com/ko/notices/830), [magazine](https://pedia.watcha.com/ko/magazine) | A Korean-language precedent for catalog-centered evaluation and editorial discovery. | A measured Korean VN opportunity; no current Korean audience-size claim is made here. |
| Metacritic describes a curated critic score and separately displays user evaluation. [About](https://www.metacritic.com/about-us/), [score separation](https://metacritichelp.zendesk.com/hc/en-us/articles/14482674768791-Are-user-votes-included-in-the-METASCORE-calculations) | Readers can benefit from clearly scoped evaluation populations and rules. | Demand for an arbitrary multidimensional scoring engine or for every community to run its own panel. |
| MetaBrainz lists organizations using its datasets for metadata matching, enrichment, discovery, and music-library tools, including named commercial supporters. [Supporters](https://metabrainz.org/supporters) | Reusable catalog data has an established downstream application category. Accurate music identities can support both user discovery and future integrations. | A paying customer base for REZICS, entitlement to redistribute every source field, or a reason to launch a developer business immediately. |

Reading-history portability is also a competitive baseline: StoryGraph explicitly supports importing reading shelves from Goodreads. It should be considered part of first-user usefulness, not postponed until after users have manually reconstructed years of reading records. This observation does not authorize collecting another service's private data. [StoryGraph import description](https://www.thestorygraph.com/)

The differentiated opportunity is a hypothesis: combine accurate multilingual/edition identity, unusually useful relationship discovery, user-controlled records, and community curation in one dependable product. This is stronger than a raw catalog-count promise, but must be validated with actual task success and return use.

## 3. What the existing reports enable

The [platform report](REZICS-动态元信息与渐进扩展架构-20260905.md), [structure/query report](REZICS-内容结构关系与查询模型-20260906.md), and [catalog boundaries report](REZICS-Catalog领域边界与实施分期-20260906.md) contain enabling architecture, not complete product delivery.

| Architecture direction | Concrete user value enabled | Required product work beyond storage |
| --- | --- | --- |
| Specific editions can exist independently; Work is established when its identity is evidenced. | Find the book or release actually read, while navigating related editions and series. | Distinguishable search results, sensible grouping, explicit review/rating scope, and identity-preserving personal records. |
| Typed fixed fields plus governed dynamic facts and predicates. | Rich metadata and new filtering capabilities without endless one-off forms. | Domain-specific display and editing; terms users understand; unknown or unavailable information represented honestly. |
| Multi-participant relations with context and evidence. | Find works through a character, actor, translator, composer, publisher, or soundtrack connection. | Correlated queries, match explanations, version/episode scope, and spoiler controls. |
| Content structures distinguish content identity from an occurrence. | Useful series/chapter navigation and reliable reading or viewing continuation. | Progress propagation rules, repeat-reading semantics, and repair when an edition's structure changes. |
| Source records, observations, adopted facts, and revision evidence are distinct. | See why information is shown, correct an error, and benefit from continued source updates. | Compare changes, choose inheritance scope, protect accepted corrections, and provide an understandable submission outcome. |
| Unified public Entity with private authentication and explicit representation. | Creators, publishers, translators, and community organizations can contribute under recognizable identities. | Claims, scoped delegation, revocation, disclosure, and protection from impersonation or rating manipulation. |
| Shared collections, ratings, tags, discussions, and access. | A book, VN, soundtrack, or creator can participate in familiar user actions. | Appropriate verbs and target scope; a shared API does not make every action appropriate for every object. |

No requirement follows to expose raw predicate IDs, physical domains, source reconciliation internals, or schema vocabulary in ordinary user flows. Editors need richer information through their own tools.

## 4. Current-source findings that affect the product plan

This is code and contract inspection, not browser or production acceptance. No frontend server, rendered interaction test, screenshot review, or design audit was performed.

| Finding | Evidence | Product consequence and disposition |
| --- | --- | --- |
| Search already has language expansion, aliases, indexed relational filters, keyset pagination, and bounded execution. Its public `relevance` ordering is documented as `updatedAt DESC` plus Unit ID rather than a relevance score. | [Search README](../../services/main/src/services/search/README.md), especially its ordering and result-semantics sections. | U01 needs an explicit title/alias/identifier retrieval and ranking gate. A recently edited weak match must not systematically outrank the requested title. Preserve cost bounds while changing ranking; do not simply enlarge a fixed candidate window. |
| Reviews and scores are implemented; reviews can refer to a progress entry, language, publication realms, and an optional score. Scores are integers 1–10 scoped to profile, target, and realm. | [Review API](../../services/main/src/services/api/reviews/schema.ts), [score schema](../../services/main/src/services/database/schema/score.ts). | Improve the existing path. Do not plan reviews or scoped scoring as entirely new products. Clarify evaluation population, target, visibility, and the difference between a review and a rating. |
| Score rows are current mutable state; posts intentionally display live scores. Immutable score history and point-in-time rendering are explicitly deferred in the schema. | [Score and post-score contracts](../../services/main/src/services/database/schema/score.ts). | Keep live personal/community ratings. Add frozen rules/results only for organized rounds that promise historical reproducibility; do not silently reinterpret old rounds after rules change. |
| Collections are stored flat ordered membership, and membership is unique per collection/Unit. Adding a review may add its subject, but this does not create a second hierarchy. The item contract has no recommendation-note field. | [Collection schema](../../services/main/src/services/database/schema/collection.ts), [Collection API](../../services/main/src/services/api/collections/schema.ts). | Existing infrastructure supports ordinary book lists. Add an explicit way to attach the curator's reason to an item or its associated review; do not require the reader to infer it from adjacency. Query-backed lists and grouped editorial layouts are separate later capabilities. |
| Progress already has user-editable journal entries, completion entries, date precision, structural references, and current-state selection. It is expressly a product history rather than an immutable audit log. | [Progress schema](../../services/main/src/services/database/schema/progress.ts), [Progress API](../../services/main/src/services/api/progress/schema.ts), [entry UI model](../../apps/web/features/progress/model/progress-entry.ts). | Preserve and complete this capability. Reading history should support offline reading and uncertain historical dates. Visiting a page is not proof of reading it; personal records must not become a by-product of catalog change history. |
| Entity related-content discovery currently asks for credit or subject-association matches against an Entity ID. | [Entity-related query](../../apps/web/features/entities/model/entity-related-content.ts). | This is useful existing groundwork, but not evidence of arbitrary correlated character/role/edition queries. U06/U08 need stronger relational scenarios and explanations. |
| Follow state does not itself define which activities are surfaced or enable notification channels. | [Follow schema](../../services/main/src/services/database/schema/follow.ts). | U10 must define meaningful event types and user controls. Turning every metadata refresh into a notification would be a product error. |
| Public identity unification and many future domains are proposed rather than delivered. | [Catalog status inventory](REZICS-Catalog领域边界与实施分期-20260906.md#11-当前源码基础与明确缺口). | Reuse verified existing foundations, but gate organization participation on the authorization implementation. Do not count schema sketches as shipped catalog coverage. |

These findings identify required checks and concrete contract limitations. They do not justify blanket claims that the current rendered UI is broken.

## 5. Product portfolio and stable user-scenario matrix

Scenario IDs are stable references for implementation plans. "Launch" means required before the associated public claim or campaign, not that all rows must be finished before any internal pilot. Each value line can be delivered and assessed independently.

| ID | Product line and user task | Minimum acceptance | Launch disposition | Primary metric |
| --- | --- | --- | --- | --- |
| U01 | Search a known book/VN by title, original title, common alias, or exact identifier. | Correct identity appears prominently; editions can be distinguished; the query language need not equal the interface language; unavailable/uncertain coverage is not disguised as an authoritative no-match. | Launch core. | Top-1/Top-5 success on a versioned query set; result-to-relevant-detail success. |
| U02 | Read useful reviews and ratings to decide what to read or play; later contribute one's own. | Relevant reviews are discoverable; rating source/population, count, target, and spoiler status are clear; empty communities are honest; editing and moderation outcomes are recoverable. | Launch core, with actual editorial/community seeding. | Detail-to-review/list use; helpful review consumption; returning contributors. |
| U03 | Discover, save, create, order, and share a book list. | Ordering persists; item identity and recommendation reason are clear; private drafts stay private; shared URLs work for intended viewers; removed/unavailable items do not erase the curator's intent. | Launch core. | Lists with meaningful item interaction; saves from shared lists; curators returning to maintain lists. |
| U04 | Record reading history, status, completion, and repeat reading; find a previous record. | Manual history works without hosted text; date uncertainty is preserved; repeat completions do not overwrite prior reading; current status is explainable; editing, privacy, and export work. | Launch core. | Second intentional history action within 28 days; successful retrieval/edit of an earlier record. |
| U05 | Discover works through tags and combined preferences. | Tag meanings and scope are clear; AND/OR/exclusion semantics are reliable; incomplete source tagging is distinguished from a proven negative; results explain matching criteria. | Launch core on declared supported filters. | Qualified result selection and save; judged query correctness; filter reformulation rate. |
| U06 | Find works featuring a character with selected traits or a particular performance. | Multiple traits can bind to the same character; actor, character, work, and release/episode constraints stay correlated; results identify the matching character/relation; spoiler settings apply to explanations too. | Differentiating launch line for VN/ACG coverage. | Successful character-to-work tasks; false-match rate on adversarial fixtures. |
| U07 | Choose a usable language/version, including official translation and publisher/translator context. | Original-language metadata, localized title, available release language, official status, machine translation, and responsible organization are distinct; source evidence is inspectable; missing authority stays unknown. | Launch core before multilingual/VN coverage claims. | Successful version-selection tasks by locale; wrong-edition selections; qualified language coverage. |
| U08 | Explore a creator's credits, related adaptations, and a work's soundtrack or character song. | The connection names its role and scope; credit-as-written is preserved; soundtrack release, recording, track occurrence, and composition are not collapsed; the relationship can be followed without understanding the internal model. | Launch a bounded useful set, backed by all three source adapters. | Relation-to-related-item engagement; judged path correctness; saved related items. |
| U09 | Correct metadata, add a missing item, bind another source, and understand the outcome. | Duplicate candidates are suggested without title-only merging; evidence and proposed changes are visible; pending/rejected/accepted states and reasons are accessible; accepted edits survive unrelated refreshes. | Launch contributor and operator utility. | Time to useful decision; accepted correction rate; later reversal/false-merge rate. |
| U10 | Follow a series, creator, list, or release and receive relevant updates. | Opt-in event categories; meaningful change summaries; digest/mute controls; retry/deduplication; no alert for an irrelevant raw-source update. | Bounded launch version; broaden event types after use evidence. | Useful notification-to-action; opt-out rate; duplicate/irrelevant notification reports. |
| U11 | Compare or participate in a community/organization's evaluation. | Visible organizer, eligibility, rules, sample size, distribution, target scope, and time basis; live scores remain distinct from any frozen round; no accidental double counting across identities or realms. | Small invited launch pilot using the existing 1–10 model. | Completed evaluation rounds or recurring community participation; rules comprehension; evaluation disputes. |
| U12 | A creator/publisher/translation group claims an identity and delegates specific contributions. | Claim evidence and representation scope are explicit; ordinary catalog edit ownership grants no account control; revocation works; actual operator is auditable; self-interest is disclosed where relevant. | Invited participation after identity/access gates, not an open launch prerequisite. | Successful verified contributions; time to resolve claims; unauthorized-action failures must remain zero in acceptance tests. |
| U13 | Bring existing personal records and take REZICS records away. | Preview mapping and conflicts; conservative identity matching; repeat import is idempotent; uncertain rows remain recoverable; export includes dates, privacy, scope, and notes in a documented format. | Launch core for basic file import/export; individual provider connectors can follow. | Import completion and unresolved-row resolution; successful export/reimport round trip. |
| U14 | Run a shared reading session, challenge, or spoiler-aware discussion. | Explicit membership, progress boundary, visibility, and content ownership; useful with a small real group. | Later product experiment; do not build a complex event platform first. | Groups repeating an activity; participant return and contribution. |
| U15 | An external developer consumes dependable catalog identities, facts, and changes. | Documented scoped API/export, provenance and rights preservation, versions, rate limits, and a measured consumer workload. | Later, activated by a named integration/customer; internal generated SDK remains necessary now. | Active real integrations, successful data reconciliation, support cost per consumer. |

U09 is an editor/contributor workflow. U12 is verified public representation. Neither should be confused with ordinary reader onboarding. U15 is a future ecosystem product, not the source-ingestion machinery required to run REZICS.

## 6. Product decisions to make now

### 6.1 Retrieval quality is a launch requirement

Search must first satisfy the common "I know roughly what this is called" task. Define a versioned judgment set spanning exact titles, aliases, identifiers, homonyms, transliterations, simplified/traditional Chinese, Japanese, Korean, and long-tail records. Include query/result language mismatch and different editions with identical titles.

Use exact identifier and exact/normalized title evidence appropriately, then evaluate broader ranking against judged results. The implementation plan owns the bounded physical execution design. A field called `relevance` is not evidence that the result order serves this user task. Maintain explicit completeness and count semantics for relation-heavy discovery; an empty bounded window must not be rendered as proof that no matching item exists.

### 6.2 Reading records are a personal product

Treat completion date, current state, historical checkpoints, private notes, edition, and repeat readings as explicit user concepts. A person must be able to record a paper book or a VN played elsewhere. Automatic reader checkpoints may assist an opted-in workflow; page visits and time-on-page must not silently become authoritative completion history.

Default new detailed reading histories and private notes to private; provide explicit public sharing. Preserve existing records' chosen visibility through migration. Provide a small, durable portable format before provider-specific account integrations. Missing catalog identity is a recoverable import state, not a reason to discard the personal record.

### 6.3 Lists require curation, not just membership

Retain the existing ordered Collection model for the first book-list product. Give a curator a direct way to explain why a particular item belongs, optionally through an explicitly attached review. The owning plan should choose the smallest coherent item-note/reference representation; it must not rely on undocumented adjacency between a book and review.

Do not make dynamic lists, nested editorial layouts, collaborative real-time editing, or an unrestricted page builder prerequisites for good ordinary book lists. Curated starter lists should be authored for named audiences, such as short completed VNs available in a selected language or entry points into a series. Avoid filling lists with generic generated blurbs.

### 6.4 Organized scoring starts with a simple, explicit population

Preserve the current 1–10 integer scale and one current score per acting participant, target Unit, and Realm. The identity migration must preserve the intended participant semantics. An organization organizing a community's ratings is distinct from an organization publishing its own editorial judgment; the same fact must not count as both merely because an operator can represent multiple Entities.

For the first pilot, a Realm provides the organizer identity, membership/eligibility rules, a versioned plain-language scoring guide, and a visible live distribution/count. No mandatory multidimensional rubric, hidden weighting engine, or universal cross-community combined score is justified by the research.

If a named event promises a final panel result, create an explicit evaluation round with a cutoff, rules version, eligibility basis, and preserved result. Later changes to a participant's live score must not rewrite that historical result. This is an additional scoped product guarantee, not a demand to make all personal ratings immutable.

Keep source-site scores separate from REZICS scores and from organization opinions. Display their source, scale, count, scope, and observation date. Do not average different services' populations into a seemingly objective global rating by default. Seeded or AI-generated ratings must never masquerade as real reader participation.

### 6.5 Multilingual coverage must describe what the user can actually do

Use separate acceptance dimensions for interface localization, searchable names/aliases, metadata text language, original content language, release/edition language, and availability of translated content. A Japanese title indexed on a Chinese page is useful, but it does not establish a complete Japanese UI or translated metadata corpus.

Official status applies to a specific title, edition, translation, release, credit, or relationship claim in its scope. It is not a property of the language code itself. Preserve who asserted it, the responsible organization or rights-holder relationship where evidenced, and unknown/disputed states. The source catalog is often the reporter, not the publisher or translator. Machine translation and official status are independent: either may occur without the other.

The language/provenance plan owns the standard language-tag representation and mappings. Product acceptance should include finding an officially published Korean release of a Japanese VN, recognizing an unofficial Chinese patch, and distinguishing a machine-translated display summary from the language supported by the game. VNDB already distinguishes several of these dimensions, making their preservation a compatibility requirement rather than optional decoration. [VNDB API](https://api.vndb.org/kana)

Use narrow factual promotion such as "search and distinguish Chinese, Japanese, and Korean releases in the covered VN catalog" only after measuring the stated scope. Do not claim "full VNDB" from archived source JSON or from matching headline work counts.

### 6.6 Relationship discovery must explain its answer

Preserve same-character and same-performance correlation. Two different characters independently satisfying two conditions is not a valid answer to "a character with both traits." A voice actor playing that character in another work does not establish the requested performance in this work. Distinguish a role in one episode/version from a role across the full series.

Return a small, authorized explanation with the matching character, credit, or relation. A query may involve many facts, but users need the decisive evidence. Apply spoiler/content visibility before selecting explanations and thumbnails. Detailed adult traits from VN sources require the product's declared content policy; source availability alone does not set default visibility.

### 6.7 Continuous data updates must improve the product quietly

Source ingestion sustains catalog quality; it is not automatically a user notification product. Aggregate insignificant changes, notify only for opted-in meaningful events, and distinguish a new edition from a spelling correction. Followed source inheritance is an editor policy, while following an author or book list is a reader preference. They must not share ambiguous controls.

AI should help with proposed fact changes, conflicts, and duplicate candidates. It must not turn missing community content into invented reviews or ratings. A useful catalog page remains honest when it has no REZICS reviews.

## 7. Cold-start and launch sequence

Run capability delivery and user-value delivery in parallel. A new schema is not a sufficient launch milestone; a complete reader path is.

1. **Establish trustworthy utility.** Deliver U01/U04/U07/U13 and usable item pages. Adopt declared multilingual identifiers and source semantics. Readers can search, distinguish, save, and record content even before social density develops.
2. **Provide a real discovery corpus.** Deliver U05/U06/U08 against a recorded import snapshot and completeness manifest for all three source adapters. Start public campaigns with verified slices while full adapter coverage and operational ingestion continue.
3. **Seed community value deliberately.** Deliver U02/U03 with real curated lists and invited reviewers. Track which catalog pages have genuinely useful material instead of treating a populated metadata row as a populated community.
4. **Make contribution and maintenance sustainable.** Deliver U09 with source/update operations, user corrections, and AI-assisted review. Provide editor triage and contributor outcomes before inviting unrestricted contribution volume.
5. **Activate bounded return loops and organizational participation.** Introduce U10/U11 pilots, then U12 after access acceptance. Expand only the event types and group workflows that produce useful repeat behavior.

These are dependencies and rollout layers, not a return to one universal product funnel. A reading-history user need not write reviews; a curator may only maintain lists; a metadata contributor may never use tracking.

Data acquisition and community acquisition have different operating costs. Metadata imports do not import trusted social relationships, willingness to review, or permission to republish every external review. Start with transparent empty states and authentic contributions. Invite particular communities around concrete use cases rather than promise everything to everyone.

## 8. Measurement and acceptance design

### 8.1 Measure task outcomes, not catalog size alone

| Dimension | Required measurement | Interpretation |
| --- | --- | --- |
| Catalog coverage | Object/field/relation coverage by source snapshot, domain, language, and release status; unresolved mappings; excluded/unavailable portions. | A denominator is required. Headline imported-row totals are insufficient. |
| Identity quality | Sampled false merges, missed duplicates, wrong-edition selection, preserved source ID links. | False merges can corrupt user records and deserve separate attention from harmless duplicates. |
| Retrieval | Judged Top-1/Top-5 exact-title success, relation precision/completeness, query latency and failure rates, measured by language and query class. | High aggregate success must not hide failure in Japanese/Korean or long-tail queries. |
| Immediate value | Search-to-correct-item; successful first record/list save; import completion. | Measures activation without requiring a social network. |
| Retention | Cohort share with a second intentional useful action within 7/28 days, segmented by entry scenario. | Page opens, refreshes, automatic checkpoints, and notification impressions are not equivalent to intentional value. |
| Community value | Useful reviews read, list items used, recurring curators/reviewers, contributor response time. | Quantity alone encourages empty content and spam. |
| Trust and operations | Incorrect official-language claims, reverted AI decisions, unresolved queue age, complaints, privacy failures, retry backlog. | Product reliability depends on ongoing maintenance, not just first import success. |

Adopt a deterministic launch fixture suite covering every scenario's invariants, plus a versioned human-judged search/discovery set. For initial evaluation, use at least 300 known-item queries distributed across Chinese scripts, Japanese, Korean, aliases, identifiers, homonyms, and sparse records; document the sample rather than call it population-representative. A proposed gate is at least 95% Top-5 correct-item success overall, no language stratum below 90%, and 100% correct exact-ID resolution within the fixture scope. These are engineering/product targets, not competitor measurements; revise only with recorded evidence and an explicit scope change.

For relation scenarios, use both positive and adversarial fixtures, including same-character binding, scope mismatches, spoilers, hidden records, and missing source facts. All logical/authorization fixtures must pass; measured production usefulness is a separate question. User-visible ranking should be judged by a human maintainer or recruited testers under the repository frontend policy. This research does not claim rendered acceptance.

Instrument a small event vocabulary before promotion. Record scenario, result type, language, relevant IDs, and coarse outcome; avoid logging private reading notes or unneeded raw search terms. Product events should have stated retention and restricted access. Analytics are not a reason to expose personal history publicly.

### 8.2 Keep the cost of user value bounded

The 500-million-row baseline and 3-billion-row estimate apply to potentially corpus-scale relations, not only Unit rows. Reading entries, list membership, source observations, tag assertions, and relationships can outnumber catalog objects substantially.

The implementation plans must preserve bounded per-user history/list pagination, selective relation queries, incremental rating counts, capped notification fan-out, source-change deduplication, and queue backpressure. Do not calculate user statistics by scanning all user events on every page, or rebuild every list/score projection after an unrelated catalog change. No new physical capacity claim is made by this product report; the capacity plan must calculate row growth, hot-key effects, storage, indexes, write amplification, and maintenance for these actual user workloads.

## 9. Decisions deferred without blocking the refactor

These are implementable choices or experiments. None is an academic or logical blocker. A deferred decision has a deadline at the dependent capability, not a veto over unrelated work.

| Question | Default / decision now | Revisit trigger |
| --- | --- | --- |
| Personalized recommendation model | Start with useful explicit tags, lists, following, and transparent catalog relations; retain existing ranking where appropriate. | Real interaction data and an offline/online evaluation show added value over simple baselines. |
| Full multidimensional scoring | Do not require it. Use scoped 1–10 ratings and a rules explanation; explicit frozen rounds when promised. | A named organization has a concrete rubric and repeat participants. |
| Dynamic collections and nested editorial sections | Deliver stored ordered lists first. | Curators demonstrate repeated needs that cannot be served by item notes/reviews and ordinary ordering. |
| Shared-reading events and challenges | U14 experiment after personal-history reliability. | A real group commits to repeated use and its visibility/spoiler workflow is specified. |
| Broad music listening/scrobbling product | Deliver music metadata and useful soundtrack/creator paths now; preserve future integration. | Named listening workflow and source integration, with evidence of repeat use. |
| Commercial API, plugin/package ecosystem, other catalog domains | Keep internal contracts reusable; U15 later. | Named consumer, workload, rights scope, support owner, and operational budget. |
| Paid memberships, ads, or affiliate commerce | Not a prerequisite for architectural correctness; do not promise a revenue forecast. | Retained usage, operating-cost evidence, and a concrete proposal that preserves trust and source rights. |
| Organization claims at unrestricted scale | Invited, limited participation after access/claim acceptance. | Claim verification and abuse-handling throughput are measured. |
| Full production migration technique | Independent migration/cutover plan may choose destructive migration or replacement deployment. | Contract freeze, actual data inventory, rehearsed mapping, and recovery/cutover evidence. |

## 10. Required handoff to implementation plans

Every product plan should reference its scenario IDs, current owner modules, source/identity dependencies, complete user path, deterministic checks, operational metrics, and human acceptance responsibility. Shared foundations must remain shared implementation owners; scenario acceptance remains specific.

The operational launch is complete only when the promised portfolio can be used, maintained, and trusted: users can find the right object, understand meaningful relationships and versions, keep their records, benefit from authentic curation, and see corrections progress. Broad future catalog extensibility remains valuable, but does not substitute for those outcomes.
