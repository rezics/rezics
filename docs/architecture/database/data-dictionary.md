# Relational dictionary and integrity contracts

This dictionary specifies target ownership, keys, cardinalities, critical fields, write protocols and access paths. It is a relational specification, not executable SQL. Current code is implementation evidence: retain fields only when their semantics belong to the target, without old-contract compatibility. Every current module has a disposition in [schema coverage](../../testing/database/current-schema-map.tsv). Authentication/provider details remain in their owning contracts instead of an independently maintained duplicate.

Notation: PK is primary key, UQ is unique key, FK is concrete foreign key, REV means an immutable owner-local revision key, REF means the validated reference_value, and XREV means revision_reference. R is the owning aggregate/route key. Composite references include all owner/manifest/variant keys named below. “Current” rows are small mutable heads with CAS version; history rows are append-only except separately governed erasure of sensitive payloads. Common created/recorded times and operation references are implicit where stated in README section 4. A field marked optional must have an explicit absence meaning in its owning contract.

## D01. Native identity, reference values and addresses

| Relation | Key and critical fields | Cardinality / integrity | Main access path |
| --- | --- | --- | --- |
| <owner>_identity | PK id; lifecycle, visibility, moderation, created operation, local lifecycle version | Native identity under a stable logical owner; concrete table placement is mapped; no global identity parent | PK; selected owner lifecycle/discovery indexes |
| catalog_unit_locator | PK logical id; owner, routing generation | Rebuildable directory; global UUID admission collision detection is a command concern; never a target FK | PK; generation reconciliation cursor |
| reference_value | PK id; one concrete nullable owner-target FK | CHECK exactly one target; partial UQ for each non-null owner target; immutable mapping; allocate/reuse by unique-conflict retry | PK, derived native-ID expression index and selected target UQ; no separate generic target string |
| revision_reference | PK id; exactly one complete owner-local REV alternative | Each alternative has a composite FK to its owner revision; exactly one complete alternative; partial UQ per exact target; selected revision must be sealed | PK and target revision reverse UQ |
| occurrence_reference | PK id; one complete typed occurrence key | Includes owner, manifest/generation and occurrence id where identity is manifest-scoped; no reference to an unqualified position integer | PK; typed occurrence key |
| citation | PK id; kind; exactly one REF/XREV/occurrence_reference/external_reference; optional fragment selector revision | Discriminator and non-null checks; fragment source is exact revision; cited identity visibility checked on reads | PK; chosen target reverse index |
| external_reference | PK id; provider/namespace, exact external key or normalized URL, original spelling, resolution state | Unknown external target stays external; resolving appends resolution evidence rather than rewriting old citations | UQ namespace/key as appropriate; normalized URL hash plus collision check |
| external_reference_resolution | PK reference_id, sequence; target REF, source observation, state, operation | Known absent/unresolved/conflicted/resolved are distinct; history retained | reference_id, sequence DESC |
| slug_namespace | PK id; registered root label or concrete scope REF, normalization policy revision | Exactly one namespace form; root labels are control data, never fabricated native identities; namespace existence does not grant write authority | root label UQ; scope REF UQ |
| unit_slug_address | PK namespace, normalized slug; target REF, canonical/redirect/tombstone state, original spelling | Atomic collision check; partial UQ canonical target within a namespace; no slug-derived identity | namespace/slug and target reverse |
| identity_resolution / resolution_event | PK original REF for head; PK original REF, sequence for events; target REF, decision, epoch | No self/cyclic accepted resolution; original references stable; no automatic grant transfer | original REF; target reverse index; bounded path resolution |
| correction_case / correction_item | PK case; PK case,item; original keys, destinations, field/occurrence assignment, ambiguity, phase/cursor | Merge, split and owner relocation require complete reviewed assignments or explicit retained/ambiguous outcomes | case,status,item keyset |

reference_value is a normalized version of the current validated alternative reference, not a renamed Unit parent. Every selected target is backed by its concrete FK. There is no root-row totality requirement: an unreferenced Document exists without a bridge value. Hard deletion of a referenced native anchor is restricted; payload erasure and tombstone visibility remain separate. Arbitrary bridge creation is not an API bypass for private object existence.

The [logical Unit capability contract](README.md#34-unit-capabilities-across-owner-tables) separates owner identity, generic targeting, feature eligibility and actor authorization. REF consumers do not retain a separately writable native ID/owner or duplicate owner alternatives. A logical owner addition requires registry/bridge/adapters and capability applicability, while a physical layout change preserves its logical reference; semantic classes remain data. D03, D09 and D11 reuse these contracts without moving their feature state into a universal parent. The present implementation still has inline alternatives in some generic consumers; their conversion and qualification remain plan work.

For revision_reference, do not store an independently writable parent REF alongside the typed revision keys. The parent is derived from the selected exact revision. If a cached parent is necessary, a generated bounded guard proves equality; the cache is not a second identity authority. Partition conversion must preserve target uniqueness, which is why the first bridge layout is unpartitioned.

Generic consumers joining back to a native UUID use the exact `coalesce` expression indexed by `reference_value_native_id_idx`. The non-unique projection index supports predicate pushdown through candidate sets without a writable cached UUID or another identity authority. PostgreSQL [expression indexes](https://www.postgresql.org/docs/18/indexes-expressional.html) trade an additional index write on allocation for selective reads. Owner-specific partial unique indexes remain necessary for concrete FK reverse probes. Adding an owner changes this expression and requires budgeting its index rebuild alongside the other registry changes.

Reference allocation uses a target-index lookup, `INSERT ... ON CONFLICT DO NOTHING`, then a separate lookup if another transaction won. A same-statement CTE cannot guarantee visibility of that winner under [PostgreSQL read committed](https://www.postgresql.org/docs/18/transaction-iso.html). Stronger isolation retries the whole transaction on serialization failure. Existing mappings are never updated or deleted; a rollback removes only that transaction's uncommitted allocation. The owning command supplies authorization and transaction deadlines. Internal allocation/resolution proves referential integrity, not current read or write permission, and is not a public lookup API.

Favorites current entries and account-private history are generic identity consumers: each stores a restrictive REF, derives the native owner/id for responses and retains no independent target in its history payload. Saved previews remain private to their account; capturing a new preview requires current disclosure authority. Account erasure removes private content without deleting shared reference values.

Private recommendation exclusions also store a restrictive REF, keyed with their Auth account. Their native-ID API and feed/recommendation predicates derive the target through the reference value; merge guards decode the same reference before rejecting a merged source. Event telemetry also stores a restrictive REF; its replay key is request/REF/type. It preserves the originally observed identity, including a readable merged source, and never writes exclusion membership. Signal triggers decode the native target; account erasure removes private events while aggregate retention remains independent.

The initial identity bridge registry covers existing native owners; add the Document identity alternative when that owner is implemented. Exact revisions and occurrences use their separate bridges and complete composite keys as their owners become available, before dependent generic consumers are switched. Bridge existence never substitutes for those keys.

The initial exact-revision registry covers named-form and identifier-claim histories in the eight catalog owners. Each target includes `(owner_id, id, revision)`; item UUIDs may repeat under different owners. These history families contain complete immutable snapshots of validated heads and have no staging state. Every bridge alternative is either entirely null or a complete bounded key, and exactly one alternative is selected. A partial composite key cannot exploit PostgreSQL's nullable-FK behavior. Other revision families require their own completeness/seal guard before registration; a current-head pointer is never an exact target.

## D02. Accounts, participation and access

The [identity/access contract](../identity-and-access.md) and [connected-app contract](../connected-apps.md) own semantics. Names below identify target relation families, not a requirement to retain existing physical table names. The current schema map inventories implemented modules; it does not prove these target relations exist. Preserve Better Auth's required credential invariants through its adapter without making its user ID a public Entity identity.

| Relation family | Keys and fields | Contract | Index / lifecycle |
| --- | --- | --- | --- |
| auth_principal and credential/session/provider records | Private principal PK; human/workload kind, enforcement/lifecycle revision; issuer/subject, credential digest and validity | Multiple verified login methods can bind one principal; no public raw principal ID or secret. Better Auth owns protocol storage through the elected adapter. | Principal/issuer-subject and token-digest lookups; bounded expiry/erasure |
| entity_participation | Native Entity FK; activation/state/control generation | Catalog existence and public identity do not prove participation or control | Entity PK; lifecycle reverse dependencies |
| main_entity_preference, app_entity_preference | Principal, optional client/scope; Entity FK; expected preference revision | Private convenience selection, not ownership or permission; admission validates usability and never retargets prepared commands/consents | Principal/client unique preference; Entity reverse |
| access_subject | Stable private key; exactly one AuthPrincipal FK or Entity FK | Typed grantee/member reference with concrete identity; not a global parent for native objects or a public account directory | Unique per alternative; selective reverse indexes |
| access_scope | Stable authority key; exactly one registered platform root, private AuthPrincipal account FK or canonical resource REF | Org/Entity, Realm and other public roots use the same canonical REF path; no direct-owner aliases. Private accounts never become public Unit references | Unique owner scope; target reverse |
| membership, invitation/application, membership_event | Scope, typed subject, admission generation, state/revision; separate invitation/terms/expiry/evidence | One current enrollment per declared scope/subject; accepting validates current policy. Rejoin creates a new generation. Public Entity participation and private operational membership have explicit owner policies. | Scope/subject and subject/scope keysets; state/expiry; event owner/sequence |
| access_group, group_membership, group_parent | Scope/group PK; typed member/admission generation; explicit parent relation and revision | Multiple groups per subject; all-members sets derived. Single-parent same-scope hierarchy initially; cycles rejected. | Group/member and subject/group; parent/child reverse |
| member_set_reference | Exactly one Group FK or scope FK with a registered membership/audience relation and eligible subject type | Derived sets reuse authoritative relations; no arbitrary SQL predicate or second writable roster | Unique typed alternative; scope/group reverse |
| team_profile | Group FK; optional admitted Entity presentation, collaboration metadata/revision | One underlying roster; public Team identity/control is not inferred from membership | Group unique profile; presentation reverse |
| access_role, role_revision, role_permission | Scope/role PK; immutable definition revision, active head; canonical permissions | Built-in/custom roles; role head changes are authorized. Scope/subject applicability remains explicit; no unknown/wildcard future permissions. | Role/revision/permission unique keys; active head |
| role_binding, atomic_grant, restriction | Target scope, exactly one typed subject or member-set recipient; role/permission, validity, conditions, ceiling, revision, authority owner | Mixed AuthPrincipal/Entity/set recipients. Direct and represented contexts do not pool unrelated rights. Institutional assignment lifecycle is separate from issuing operator. | Target/action/recipient, subject/target and role/binding reverse; expiry |
| representation_grant | Represented Entity, exactly one typed delegate or member set; action/resource ceiling, conditions, expiry, revision, redelegation policy | Complete restricted path required; management, publishing, exercising security powers and redelegation are distinct | Represented Entity/delegate, delegate/target; expiry |
| authority_dependency | Dependent grant/operation and exact typed live parent/admission generation | Only explicitly dependent execution authority follows parent liveness; durable institutional assignments do not depend forever on the issuer's personal account | Dependent/parent uniqueness; parent/dependent reverse |
| authority_fence, authority_event, recovery_event | Authority key/revision; immutable outcome, private operator and selected subject, grant basis | Ordered fences and current reads include groups, roles, representation, accounts and installations; cyclic control is not recovery | Key seek; scope/event keysets; bounded suppressed evidence |
| ownership, ownership_event | Target scope/REF; protected owning subject or owner set under domain cardinality policy; revision/transfer history | One accountable Entity may have several controllers; multiple owners only where explicitly supported. No silent ownership transfer from membership. | Target/current and owner/target; serialized continuity check |
| app, app_capability_revision, oauth_client | App identity, developer/controller, immutable declared capabilities; client redirect/authentication/key metadata | App ownership and protocol client identity confer no installation resource rights | Owner/App and App/client keysets; exact client lookup |
| app_installation, installation_grant | App/scope/installation, approved revision, service AuthPrincipal, resources/actions/ceilings, state | Scope-owned lifecycle; initial per-installation machine-client mapping requires adapter qualification | Scope/App, App/installation, service/client unique mapping; target reverse |
| oauth_consent, external_account_binding | Client, verified issuer/subject context, selected authority subject/Entity, scopes/resources, grant generation, status | Public Entity identity separate from pairwise login identity; no account merge or default-driven retargeting | Client/subject and Entity/binding keysets; revocation/erasure |
| token_context, token_dependency | Credential digest/verified token reference; consent/installation/representation basis, audience and lifetime | No raw account graph in external tokens; signature/refresh alone never bypasses current dependencies | Digest/context lookup; dependency reverse and expiry |
| webhook_subscription, delivery, attempt | Installation/resource/event scope, destination, delivery/idempotency identity and attempt state | Current disclosure before delivery; signed retries with bounded retention; event is not a permanent access grant | Installation/subscription and due-delivery keysets; attempt owner/sequence |
| disclosure_grant / disclosure_event | Exact XREV/asset REV, audience/scope, issuer, purpose, active epoch | Publishing one private version never publishes its whole branch or undisclosed attachments | Exact target/audience; issuer/revocation cursor |
| license_claim, license_selection | Target content/asset/occurrence, license contract/version, territorial/time conditions, claimant, evidence | A license description is not a runtime entitlement or proof of authority | Target/scope/current; evidence reverse |
| unit_license_grant / recognition event | Target REF, instrument id/version, immutable declarant/time, offering end, recognition history | Multiple instruments coexist; open target/instrument uniqueness includes invalidated rows; recognition cannot reopen an ended offering | Target/open; instrument/effective; target/history |
| platform_capability_binding, account_enforcement | Mixed grantee and platform scope, capability/action, validity, decision; separate actor enforcement | Preview and operational eligibility stay independent from ordinary resource authority; action-specific assurance and accountability remain enforced | Scope/recipient/current; actor/expiry |

Representation is many-to-many. A default preference is not the old unique self binding, and an arbitrary acting-Entity value is not proof. Keep concrete foreign keys for every admitted alternative; a discriminator plus unchecked id is insufficient. Public selectors expose authorized Entity presentation or purpose-scoped private handles, not this internal subject directory.

Role and Group membership, direct target rights and representation rights retain separate relations. A binding can refer to a live local role head, but cross-authority/App grants preserve approved ceilings. Revocation invalidates live dependencies before bounded cleanup; parent deletion cannot cascade over an unbounded graph in a request. Use the [capacity envelope](../identity-access-capacity.md) for row amplification, indexes, query budgets and growth qualification.

Independent catalog intake and participant construction retain separate admission policies. Neither current self-identity implementation nor resource/proposal grants establish authority to create unrelated identities. Default onboarding, new public personas and third-party connections must each prove their own control admission under the target contract.

## D03. Definitions, claims, evidence and acceptance

| Relation | Key / fields | Invariant | Query / partition owner |
| --- | --- | --- | --- |
| definition, definition_revision | PK definition id; namespace/key UQ; revision PK definition,id; kind, value type, domain/range contract, cardinality, qualifier schema | Frozen meaning; semantic change gets new identity; extensions are data contracts, not executable SQL | Definition PK and namespace/key; bounded control data |
| semantic_context | PK id; context type, exact canon/world/time interpretation, optional parent | Context is not governance scope; parent cycle policy declared | PK; parent index |
| fact_slot | PK subject REF, slot_id; property identity/contract, context, language/variant dimensions | Canonical slot uniqueness; no random keys to evade one-value semantics | Subject/property/context unique key; property/value read projections |
| assertion | PK subject REF, assertion_id; slot_id, claimant, state, contract revision, typed value alternative, validity, operation | Exactly one legal value alternative or explicit absence state; original claim immutable | Subject/slot/assertion; claimant and exact target reverse |
| typed_value / sensitive_value | PK id; boolean/numeric/quantity/date/text/reference alternatives, precision/unit/calendar; payload availability | Values preserve zero/false/empty; sensitive data can be erased without changing the claim into unknown | PK; only elected typed predicates indexed |
| source_observation_evidence | PK observation, evidence_id; field path/span, transform version, payload receipt | Exact immutable observation; no overwrite by newer source fetch | Observation/path; payload/erasure cursor |
| assertion_support | PK assertion key, support_id; evidence or independent claim, supports/refutes relation, state | Multiple supports coexist; source withdrawal removes only owned support | Assertion/support and evidence reverse |
| acceptance_decision | PK slot key, decision_id; scope, state, policy revision, basis, validity, expected predecessor, sealed | Single accepted value per single-valued slot/scope/valid slice; conflict is explicit | Slot/scope/history |
| decision_member | PK decision key, member_id; assertion composite FK, role/weight if policy supports it | Same slot/definition; immutable after seal; accepted set cardinality checked under slot lock | Decision/member; assertion reverse |
| effective_fact_head | PK slot key, scope; decision FK, CAS, freshness/support epoch | One current decision; values are derived from sealed members; unavailable support marks pending/conflict per policy | Subject/slot/scope; no independent user edits |
| association | PK id; owning governance/maintenance context, current description head | Identity is not participant tuple equality | PK; owner list |
| association_revision | PK association,id; predicate definition REV, semantic context, valid-time value, sealed manifest | Exact participant set belongs to one revision | Association/revision |
| association_participant | PK association,revision,slot_id; role definition REV, ordinal, REF/citation, credited name REV | Same participant may appear in multiple slots; ordinal and slot constraints per predicate | Association/revision/ordinal; target/role/association reverse |
| participant_type_witness | Exact association REV/participant slot, required contract, concrete capability REV and epoch | Generic reference existence alone is insufficient; current acceptance compares live capability epoch while historical queries preserve old witness | Participant PK; capability reverse for bounded revalidation |
| association_claim, association_support, association_decision | Exact association revision; claimant/evidence/scope/basis | A described relation is not automatically true/accepted in every scope | Association/scope; source evidence reverse |
| source_statistic | Provider/record/observation, measure definition, sample/count/value/time | Source scores/counters never manufacture native ballots or votes | Provider/target/measure/time |

For temporal single-value results, either use exclusion constraints on exact effective intervals or stage and validate a non-overlapping accepted timeline under the slot lock. Uncertain intervals are not silently coerced into exact ranges. Ordinary current-head queries are separate from historical valid-time queries.

Participant targets may span registered catalog and platform owners when the predicate's role contract permits them. The current catalog-only target set is not the target Graph API's full admission contract. Valid REF existence, compatible structural capability and current authority must each be established. [Selected query indexes](README.md#13-search-recommendation-export-and-derived-state) distinguish subject-local fact reads from global property/value search; a typed value node is not evidence that every such search is indexed.

## D04. Names, identifiers and language

| Relation family | Key / fields | Contract | Access |
| --- | --- | --- | --- |
| <owner>_named_form / named_form_revision | Owner, form id, revision; text, BCP 47 tag, script, sort form, usage, context, validity | Same-language alternatives allowed; original spelling retained; sealed versions | Owner/form/history; bounded owner lists |
| <owner>_identifier_claim / revision | Owner, claim id/revision; namespace, exact/normalized value, syntax validation, claimant/evidence | Nonunique claimed value by default; authoritative uniqueness is namespace-specific | Namespace/value hash+exact comparison; owner claims |
| <owner>_name_authority / revision | Exact name REV, authority entity, scope, evidence, active state | Officialness is scoped and revision-specific; changed name does not inherit old approval | Name/scope; authority reverse |
| <owner>_name_selection | Owner, scope, display purpose, language; selected form REV | Explicit fallback policy; selection does not change officialness | Owner/scope/language UQ |
| <owner>_name_source_binding / occurrence | Source record/local key plus observation; exact form REV | Unstable upstream keys are observation-qualified; reused keys conflict | Source record/local key and snapshot |
| content_language_support / projection | Target REF, language, consumption channel/unknown channel state, provenance | Separate from UI locale and display localization; language-level statement is not empty channel list | Target; language/channel/target reverse projection |
| display_localization / editorial_metadata | Owner/target, locale group, revision; short summary and presentation metadata | Short metadata stays typed/local; long authored descriptions use content slots/Documents | Target/locale; no full-row history copy on unrelated edits |

## D05. Publishing, program and distribution catalog

The following are domain implementation families, not competing definitions of Work. Each eligible identity implements the common Work/release protocol with its domain attributes. Work and release stay distinct, and virtual versus actual issuing adds applicable metadata rather than a separate feature system.

| Relations | Keys / crucial fields | Grain, cardinality and constraints |
| --- | --- | --- |
| publishing_work | Publishing identity FK; domain metadata; Work slots/structures use D09-D10 | Textual specialization of the common native Work contract; metadata-only valid; not the definition or mandatory parent of every Work |
| publishing_text_version, publishing_text_work | Text identity; language, derivation and Work correspondence/coverage | Independent official/community contributions, including same-language alternatives and multi-work text containers; correspondence is not adoption or text equality |
| publishing_publication, publication_text, publication_work, publication_facet | Virtual/actual publication identity; distribution specification; content PK publication/manifest/occurrence, target text/Work, order, coverage; applicable identifiers | Shares domain composition rules with Work, but owns its selection and issuing scope; repeated targets permitted |
| publishing_release_event | Publication/event id; area, date value, channel/status | Multiple releases across countries/dates; announced/cancelled is not occurred |
| publishing_serialization, publishing_installment | Serialization identity; installment occurrence, issue/order/original number, text/coverage | Installment appearance differs from chapter text; order and progress pin exact manifest |
| program_work, program_season | Audiovisual Work/season identities and contextual membership | Common native Work eligibility with distinct season scope/order; membership is not ownership inheritance |
| program_version, program_episode, program_episode_occurrence | Cut/version identity; episode identity; manifest occurrence, displayed number, coverage | A cut can have a different episode structure; repeated appearances and specials remain representable |
| program_release_event | Program/cut/episode exact target; channel/area/date/time precision | Broadcast event differs from content revision |
| distribution_package, distribution_manifest, distribution_revision | Package owner; sealed manifest; current selection | Optional mixed-domain bundle; independent native authoring |
| distribution_member | PK package,manifest,occurrence; ordinal, quantity, coverage, typed concrete content target | Exactly one eligible target FK; repeated target permitted; no arbitrary recursive package target in initial contract |

All child lists use parent/manifest/ordinal/occurrence keysets and target reverse indexes. History and source correspondence include original owner and child revision; replacing a manifest does not destroy the old correspondence. A complete manifest can be staged in bounded chunks and restored by pointer selection without copying all members.

The [native Work contract](native-work.md) owns cross-domain identity and release meaning; [composition](content-composition.md) owns explicit assembly and import. Publisher language/ISBN metadata cannot narrow the Work's community content policy. A Work's selected contents use D09 adoption revisions and D10 structure manifests; known-empty, metadata-only and unknown contents remain distinguishable. Aggregation or part links can connect several independently maintained Works without an exclusive primary parent. The current publication/target primary keys cannot represent repeated occurrences; persistence qualification must replace those keys together with histories, source correspondence and consumers.

## D06. Music catalog

| Relations | Critical content | Cardinality / authority |
| --- | --- | --- |
| music_work, music_work_language | Composition identity, languages, typed properties under native Work scope rules | Optional realization links use contextual n-ary associations; shared Work meaning does not equate compositions and recordings |
| music_recording | Recording identity, duration/precision, credit and identifier claims; native Work role when independently maintained | Reused content across releases; distinct from composition; no title/hash/ISRC-based identity equality |
| music_release_group, secondary_type | Release-family identity/classification; independently maintained album Work requires its explicit scope and composition | Family grouping alone owns no universal tracklist and does not supply publication contents |
| music_release, release_event, release_label | Virtual/actual issuing specification, events/territories, label occurrence and catalog number | Shared domain composition protocol; applicable catalog number belongs to label/release use |
| music_medium, music_track_occurrence | Sealed release structure; medium identity, format/order; track recording/title/printed number/local credit/order | Same recording can occur repeatedly; changes to printed title do not overwrite recording title |
| music_artist_credit, artist_credit_name | Sealed ordered credit expression; artist REF, exact name, join phrase, ordinal | Credit expression is not a person/group; reuse only under compatible retention domain |
| music_disc_toc, toc_offset, medium_toc | Medium-qualified TOC, offsets, disc identifier, declared format | Format-specific constraints; unknown tracklist separate from zero tracks |
| music_medium_attribute_policy / allowed format/value / attribute | Versioned format eligibility and typed attribute values | Local structural contract; not unchecked JSON or universal 99-track bound |
| music_credit_identifier, medium_identifier, track_identifier | Identifier claim on exact local credit/medium/track | Correct occurrence owner/revision FK |
| music_release_presentation, medium_presentation, track_presentation, alternative_track | Alternative naming/credit/track presentation with exact source evidence | Alternative/pseudo presentation does not assert a new real issued product |
| music_release_candidate, candidate_track, candidate_toc | Incomplete candidate evidence and provisional structure | No fake complete release; explicit promotion with correspondence |
| music_component_revision, head, source_occurrence | Owner/child exact revisions, head and correspondence | Structure and source changes use the same sealed-generation protocol |

Specialized indexes remain parent-local and on elected reverse targets. Technical TOC validation cannot be generalized to every distribution domain.

## D07. Software, entities, grouping and reference catalog

| Relations | Critical content | Contract |
| --- | --- | --- |
| software_content, software_visual_novel | Native project/game Work identity and typed VN facet | Common Work continuity, including explicit independent forks; semantic reclassification alone preserves identity |
| software_variant, software_version | Functional variant; version/build identity, scoped label, exact build/resource provenance | Labels may be reused; uniqueness depends on ecosystem/publisher namespace, not string alone |
| software_release / content / platform / language / medium / event | Selected exact contents, platform, language channels, media and distribution occurrences | Virtual/actual release contract with build/patch compatibility; published selections do not follow mutable inputs implicitly |
| software_participation_context / revision | Native contribution scope, name/language/officialness claims, relevant content identity | Observation-local upstream edition ids are correspondence, not native version proof |
| software_participation / revision / credit occurrences | Person/character/organization, role, alias, release/context, language and evidence | Voice actor-character-work/release is one scoped relation; no uncorrelated binary reconstruction |
| software_patch_target, software_release_animation | Typed patch/dependency target, compatibility/version selector; animation attributes | Patch is not full replacement by default; range claim differs from resolved dependency |
| software_record_revision, component_revision, source correspondence | Exact record/component native snapshots | Stale source applications compare local head and human epoch |
| entity_catalog_profile / revision | Person/organization/character/software-agent structural metadata | Source claims, birth/death/fictional calendars separated from account lifecycle |
| grouping_class_assignment, order_profile, order_entry, command_revision | Universe/canon/franchise/series role and versioned membership/order | Multiple contextual memberships; no implicit containment/permission |
| reference_concept, web_resource, area/code, place, instrument, event, profile_revision | Native concepts and supporting referents with typed metadata | Cross-source reuse; external resources are not trusted executable content |

Catalog identity kind changes require capability eligibility validation. If a field changes from uncertain to known, retain its previous claim/evidence. If classification invalidates a structural dependency, advance capability epoch and mark dependent current acceptance pending review; preserve historical validity under the old contract.

## D08. Authored documents and assets

| Relation | Keys and fields | Integrity / query |
| --- | --- | --- |
| document | PK id; maintenance authority, lineage purpose, lifecycle | No length/type discrimination; independent of Work and publication |
| document_variant | PK document,variant; language, representation contract, optional variant label | No UQ(document,language); one variant may have multiple branches |
| document_revision | PK document,revision; variant composite FK, format REV, content manifest, operation, attribution, sealed state | Immutable completed snapshot; UQ(document,variant,revision) for head FKs |
| document_branch | PK document,variant,branch; head REV, CAS | Head belongs to exact variant and is sealed; one head per branch |
| revision_parent | PK document,child,parent; parent exact variant/revision | Same-lineage DAG; sealed parents precede new child; no retroactive parent insertion |
| revision_derivation | Output exact REV, input exact REV, relation, selector/coverage, contribution | Cross-document derivation; does not automatically grant rights or endorsement |
| document_manifest, document_manifest_item | PK manifest; PK manifest,item; ordered content/asset/embed references, format, count/digest/completeness | All embedded items are fixed; staged manifest cannot publish; selected dependency disclosure rechecked |
| revision_attribution | Exact REV, contributor slot; credited persona/entity/software-agent, role, declared/verified assurance | Actual operator is separate; AI credit is not proof of human authorship or authority |
| revision_visibility / event | Exact REV; protected fields, visible/hidden/suppressed state, actor/basis | Separate availability controls; current published dependencies must be invalidated/cleaned before suppression is considered complete |
| fragment_anchor / anchor_resolution | Exact REV, selector contract/id; attempted mapping to newer REV with confidence/state | Old fragment remains exact; unresolved mapping never silently changes quotation |
| payload_object / receipt | PK payload id; storage domain/key, bytes/digest/media type, availability | Object receipt is not global Work identity; size/availability independently validated |
| asset / asset_revision | Asset PK; REV key asset,revision; media class, immutable content descriptor, binding assurance, author/maintainer/provenance, availability | Media-resource owner only; independent from Catalog Work/recording/video and Document; verified_digest/provider_revision/locator_only assurance explicit |
| asset_representation | PK asset,revision,representation; encoding/rendition role, format, exact input, transform contract, optional verified payload/digest and typed technical metadata | Many representations per asset revision; dimensions/codec/size valid for its media class; no unique asset-only object constraint |
| asset_location / location_observation | Representation composite FK, location id; hosted storage key or external locator, provider key, observation, availability/freshness | Multiple origins/mirrors/cache locations; URL changes do not retarget asset identity; unverified remote bytes never become byte-exact proof |
| file_asset, file_revision | Independently maintained logical file identity; exact representation/payload, name, media type, origin and retention domain | Allocate only when independent file identity is needed; do not duplicate media identity merely for another URL/encoding |
| asset_use | PK use_id; subject REF, relationship purpose, maintenance scope and current revision | Many uses per subject; same asset may be used repeatedly/across subjects; no UQ(subject,asset) that collapses distinct uses |
| asset_use_revision | PK use_id,revision; exact asset REV, caption/credit, selected applicability manifest, provenance, state, sealed flag | Fixed native relationship description; historical source/context preserved; immutable after seal |
| asset_use_role | PK use_id,revision,role definition REV | Multiple compatible roles allowed; required type witness validated; front role is not primary selection |
| asset_use_applicability | Exact use REV, qualifier occurrence; typed subject/release/work reference, language/territory/variant or declared relative mode | Explicit all_release_languages differs from unknown; relative interpretation pins source observation and release version; validate bundled-work membership |
| asset_use_support / source occurrence | Exact use REV, support id; source record/image key, observation/entry, original roles/order/flags and mapping contract | Multiple supports; source approval is evidence only; withdrawal never erases unrelated human adoption |
| media gallery occurrence | Existing structure/manifest/occurrence key; exact use REV, native rank and local caption/credit | Reuse structure protocol; source ordering and native gallery ordering remain separate; bounded keyset reads |
| media selection | Existing content_slot/adoption REV with selected asset_use REV and representative relationship witness when needed | One current selection per single slot/scope/language/purpose; no second media-primary ledger and no global asset is_primary |
| adoption_presentation | PK slot,adoption revision; fit, crop/frame/page selector, presentation contract | Configuration applies to this selected use; normalized crop checks; selection cannot override current disclosure |
| asset_derivative | Output representation/asset REV, exact input, transform contract, operation | Resize/transcode normally creates representation; independent retouch creates derived asset by explicit intent; stale job token cannot activate |
| media_stream / track_attachment / media_selector | Exact representation/asset REV, stream or attachment slot, typed codec/language/channel/timebase; exact subtitle/audio/poster target | Preserve audio/video/subtitle structure; PDF page and excerpt time selectors have typed bounds/unknown states |
| image_asset, image_object, audio/video target integration | Existing immutable image content IDs mapped with explicit asset/revision receipts; Catalog audio/video identities retained separately | Replace asset-only physical-object uniqueness with representation keys; move global crop/cover choices to contextual selections; no automatic Work identity rewrite |
| storage_gc_candidate / erasure_item | Domain/payload, observation/fence/grace deadline, erasure request | Recheck live references/retention before deletion; account/payload erasure have indexed cursors |

For small comments the body can remain inline under the revision payload contract; object storage is not forced per sentence. File/manifests and rich-content references use the same disclosure principles without requiring identical physical payload layouts.

The AssetUse subject is the actual referent supported by evidence, often a particular release. A Work's representative cover can adopt that use only with an explicit eligible relationship and retained release origin. The same image can have different roles, captions, credits, applicability or crop in different uses. Default display, gallery membership and source-assigned primary status are independent records.

Critical indexes are asset REV -> representations, representation -> locations, subject/scope/state/use_id -> current uses, use_id/revision -> history, source record/image key/observation -> correspondence, and exact asset REV -> affected uses for bounded withdrawal/erasure. Role/language/territory discovery uses typed selective projections; a global JSONB scan is not the gallery read path. Ordering uses stable keyset cursors with occurrence tie-breakers, not offset pagination or an eager count of every media item.

Publication/adoption and payload erasure recheck asset, use, scope, representation and disclosure fences. Private/suppressed originals cannot leak through thumbnails, poster frames, signed URLs, caches or exports. Metadata-only external indexing stores evidence and assurance explicitly; a mutable URL is not proof of stable bytes. Missing source coverage, failed downloads and native withdrawal have different states. README section 8.1 defines source mapping and representative-selection behavior.

## D09. Publications, content slots, threads, reviews and polls

| Relation | Keys / fields | Contract / access |
| --- | --- | --- |
| social_publication | PK id; publisher, originating scope, lifecycle, current head | Stable utterance identity; independent from catalog publishing_publication |
| publication_revision | PK publication,revision; audience, presentation/workflow contract, operation, sealed manifest | Exact published selection; update does not allocate a new utterance |
| publication_item | PK publication,revision,item; ordinal; exact document/asset/poll/share citation alternatives | No dummy Document for pure share; exactly one item kind; ordered manifest |
| publication_head | PK publication; exact REV, state, CAS | Small current publication selection; never points at private draft head |
| release_channel / channel_head | Document/variant/channel key; selected sealed REV, publisher and epoch | Author publication channel is not the editor branch head; follow produces new durable selections |
| content_slot | PK id; scope, subject REF, role identity and pinned contract, language/variant dimensions, cardinality | Canonical unique tuple including nullable dimensions with NULLS NOT DISTINCT or explicit canonical values |
| adoption_revision | PK slot,revision; decision basis, actor, state, selected XREV for single role OR manifest for multi role | Single and multi alternatives explicit; selected count fits role contract; no empty adopted single slot |
| adoption_member | PK slot,revision,occurrence; selected XREV, rank, local credit/caption | Multi role only; repeated use allowed if contract permits; seal freezes members |
| adoption_head | PK slot; exact adoption REV, CAS, current validity/support epoch | Exactly one current selection per canonical slot; withdrawal/conflict/no-selection are states |
| selection_subscription | PK slot,subscription; exact channel, update policy, scope authority epoch, status | Following updates needs reauthorization and a new adoption revision |
| thread, thread_topic | PK thread; scope/state/generation; topics are citations | Zero or more topics; no mandatory root publication |
| reply_origin / resolution_event | PK publication; root/resolved/unresolved/unknown, original target evidence | Origin immutable except append-only resolution of missing data; not overwritten by move |
| response_target | PK publication,target_id; exact citation, primary/quoted/addressed role | Multiple targets and exact original revision/fragment supported |
| thread_generation / placement | PK thread,generation; PK thread,generation,placement; publication FK, parent same generation, rank/state | Acyclic placement; duplicate presentation allowed by policy; keyset thread/parent/rank/id |
| thread_scope_transfer | Thread/publication, immutable source/destination scope, decision, audience checks, activation generation | Administrative move is an explicit governed transfer, not origin deletion or ordinary placement mutation |
| review_target | Publication/target slot; subject REF, review context, role, native rating link optional | Textual opinion need not include a numeric rating; changing target is explicit history |
| poll, poll_option, poll_ballot, ballot_choice | Poll key; option identities; actor/principal/epoch unique ballot; option FK within poll | Freeze option meaning after ballots; enforce choice cardinality and eligibility; close serializes with vote acceptance |

Slot creation checks the pinned role's subject domain, target revision capability, required dimensions and cardinality. The role contract is not accepted from an arbitrary client boolean. Single-selection revisions carry one exact target only in adopted state; multi-selection revisions use sealed members. Restoration is a new selection and rechecks current disclosure and role eligibility.

Thread generation is not a sealed content revision. It supports ordinary append-only leaf creation in the active topology, with a topology-change journal and a committed frontier for bulk generation catch-up. Parent changes are explicitly serialized/validated. Copying an entire generation for each comment is prohibited. A staged generation must consume concurrent committed leaf changes before activation; otherwise activation is postponed. This requirement also applies to node moves during source structure rebuilds where the current owner permits concurrent authoring.

Editing a comment into an article keeps document/publication identities. Selecting it as a wiki body adds a slot adoption. Collaborative policy changes retain contributor history. An independent fork receives a new Document and exact derivation. All four operations use different commands even if a UI combines them into one action.

## D10. Realm, Zone, structure, curation and themes

| Relation family | Keys / fields | Contract / access |
| --- | --- | --- |
| realm, realm_unit, realm_pin; D02 membership/groups/roles | Community identity; typed enrollment and multiple access groups/custom roles; independent publication/curation and stable placement | Admission generations, representation and mixed grantees follow D02; Realm participation, Collection membership, accepted content and pinned display remain distinct |
| realm_rule_revision, realm_rule, rule_acceptance | Realm/exact rule revision/rule; account acknowledgement of exact version | New rules do not rewrite past decisions or imply retroactive acceptance |
| zone, zone_page, unit_dock | Zone identity; page/subsite infrastructure, Collection presentations, chosen rule Realm, dock composition/contract | One Zone can compose several Collections; one Collection can appear in several Zones; display does not transfer identity or authority |
| content_structure, structure_manifest, node/occurrence | Owner/structure/head; manifest; occurrence id, same-manifest parent, target REV/citation, rank, coverage, local label/number/credit | Explicit local contents; identity-only references are navigation/unknown content, not exact body promises; validated navigation is acyclic; no implicit nested expansion |
| structure_revision/head, dock_revision/head, collection_structure_revision/head | Exact owner/subaggregate revision, generation, operation | Unrelated root edits do not copy all children; restore selects sealed generation |
| composition_import / import_correspondence | Operation, exact source structure REV/path, destination structure/expected head, staged manifest, source-to-destination occurrence map | Durable phased operation; retry reuses mappings; refresh compares base/source/local edits and retains established occurrence identities |
| collection, collection_item | Curated grouping identity; explicit stored item occurrence,target,rank,local note/credit | Can organize a wiki corpus; public/private access and repeated-target policy explicit; distinct from private favorites and computed Dynamic Collection results |
| vocabulary_node, guide_node/localization, label | Vocabulary/guide identity; typed definitions, selected localized copy | Control vocabulary and authored guides retain ownership/history; guides can reference Documents |
| custom_theme, revision, review_event, file, external_resource | Theme identity, immutable submitted package, exact host/target contract, observed external evidence | Existing full-trust external-live preview retained; observed dependencies do not imply complete sealing |
| unit_custom_theme_installation, execution_control | Host/target contract UQ; exact approved theme revision; kill epoch | Every activation checks current eligibility/approval/emergency state; no follow-latest |
| unit_presentation_document/revision/head, entity_presentation/revision | Host or entity, presentation purpose, exact revision | Content and platform chrome ownership stay separate; no hidden execution grant |

The [composition protocol](content-composition.md) defines planning, staged writes, completeness validation, activation and refresh. Published selection pins exact adoption/content/structure revisions. Child-list cursors bind structure/manifest/parent/order/occurrence; whole export is resumable. Existing 2,048-node and 64-placement guards remain implementation protections until the bounded replacement is qualified, not permanent target cardinalities.

## D11. Tags, votes, ratings, follow, favorites and progress

| Relation family | Keys / fields | Contract / access |
| --- | --- | --- |
| tag, tag_relation | Concept identity and semantic relation/predicate | Tags can be renamed/reclassified without rewriting every application; hierarchical cycle rules explicit |
| unit_tag, realm_unit_tag, account_unit_tag | Subject REF, tag, scope/actor, assertion history | Feature-specific UQ on subject/Tag plus Realm or account where applicable; subject-first and Tag-first indexes; direct applications remain distinct from inferred projections |
| tag_path, member, sense, sense_binding, path_merge | Path/sense identity, ordered members and governed resolution | Path is not an arbitrary joined label string; identity/history preserved |
| unit_tag_path_application, judgments; Realm equivalents | Subject, path/sense, context, actor, value/spoiler, revision | Application and actor judgment are separate; scope never dropped during aggregation |
| tag_expression, argument, inference_rule | Versioned expression AST/contract and rule revisions | Arity/type/cycle checks; no unchecked SQL; bounded evaluation with rebuild generation |
| expression_assertion / effective_tag / inference rebuild | Direct assertion key and derived target/rule-generation output | Direct evidence not overwritten by inference; failed build keeps previous generation |
| score, realm_score_context, post_score | Rater, subject REF, context, rating scale/version, current/history | UQ per intended voter/target/context; imported scores are source_statistic; scale explicit |
| unit_reaction, share | Actor, target REF, reaction contract; share/publication link | Likes attach to declared target identity; transferring presentation does not duplicate votes |
| alias/external-link/tag judgments | Exact reference/application, actor, scope, value, revision | Validity and spoiler judgments retain their own policies rather than generic vote columns |
| unit_follow, follow_preference, tag subscription | Public Entity/REF pair; Auth preference FK to the exact pair; target/scope, delivery policy | Native self-follow check decodes REF; private erasure is separate from public interest; Follow is not membership, friendship or automatic access grant |
| account_favorite, favorite_revision/state | Account,target,private note/order/history | Account-private by default; no public Collection side effect |
| unit_progress, progress_entry, node_progress, post_progress | Account,target plus exact content/structure version, position/status and observation | Explicit versus derived completion; edition changes require mapped/unknown state |
| account_preference, account_entity_block | Account/preferences or blocker/target key, revision/state | Private; blocking and content access have distinct semantics |
| striped_counter_delta / aggregate heads | Target, metric, stripe/epoch, operation; projected totals | At-most-once delta receipt; exact ballot/eligibility independent; hot target does not serialize on one counter |

Account-private Tag current rows use a canonical target REF. The account/target/Tag key permits independent annotations by different accounts while rejecting duplicate triples. Self-targeting is checked against the reference's derived native identity; content labels and category-only concepts retain their separate applicability rules. Normal private filtering resolves the authenticated account owner; Entity selection does not switch that owner or import another controller's private Tags. A delegated administrative path requires an explicit private target/action policy under D02. Query/index budgets live with the [Filter compiler](../../../services/main/src/services/filter/README.md).

Global, Realm and account applications share the logical Unit target contract, not one scope-free assertion or copied per-kind Tag service. Apply owner state/applicability and feature authorization before allocating a reference or recording a judgment. Effective-Tag and reverse-discovery rows are rebuildable; reference existence never grants disclosure. Converting a target's physical storage must preserve the feature's target, scope and history rather than recreate its votes or memberships.

## D12. Communication and delivery

| Relation | Keys / fields | Contract / index |
| --- | --- | --- |
| conversation | PK id; kind, lifecycle, membership policy revision, local sequence allocator | Private communication identity; membership/sequence writes serialize only this conversation |
| conversation_member / event | Conversation,account/member id; joined/left and visible history intervals, role | Eligibility before every message/read; last-owner departure/recovery explicit |
| message / message_revision | PK conversation,message; sender/accountability, content REV, sequence, edit/withdrawal history | Message belongs to one conversation; body revision audience cannot be promoted through a generic content reference |
| message_recipient_state, conversation_read | Conversation,recipient,(message); hidden state/read-through sequence | Read acknowledgement is private recipient state; holes/late deliveries have explicit ordering |
| notification | Recipient,id; event, type, target citation, safe bounded payload, read/delivery state | Dedupe recipient/event/kind; private current authorization on target hydration; recipient/time/id keyset |
| notification_recipient_state | PK recipient; read-through tuple, count-generation/version | Mark-all/insertion lock protocol prevents late commit being silently read |
| notification_preference | Account/type/channel key, enabled/filter settings | Suppressed delivery does not cancel the source business action |
| email_outbox / delivery_attempt | Delivery id; recipient secret ref, template/locale, provider request id, status, attempt/uncertain receipt | Provider acceptance is not delivery; idempotency/reconciliation precedes resend; bounded retention |
| governance_notice_recipient / report_delivery | Case/decision,recipient/channel, delivery state | Notice is not the governance decision; failures observable and retryable |

## D13. Governance, correction and erasure

| Relation family | Keys / fields | Contract |
| --- | --- | --- |
| content_report, report_rule/referral | Reporter, target exact citation, evidence, rule basis, case relation | Reporting does not change content by itself; duplicate abuse handled by admission, not false identity merge |
| content_review_case | Case id, target/case type, phase, assignee, version | Multiple reports can support one case; case state independent from target lifecycle |
| governance_decision / rule | Decision id; rules basis or reversal; exact allowed rule refs | 1-32 rule refs for rule-backed decision; one unique exact reversal; immutable finalized membership |
| content_governance_action, realm status/publication events | Exact target, before/after state, decision, operation | Domain transition and rationale share one decision; forbidden state transitions rejected |
| account_enforcement_action / enforcement | Account/principal, decision, effect, validity and reversal | Enforcement remains private; no catalog-person deletion |
| audit_event | Operation, actor secret/public attribution, outcome, target, decision, version | Machine errors distinct from policy rationale; sensitive fields separately suppressible |
| unit_merge_request/review/operation/reconciliation | Pinned source/target revisions, two immutable reviewer-authority receipts and exact private read-grant selections, cursor/items | Existing catalog merge restrictions retained until replacement policy adopted; no authorization from prior discussion |
| split_case / split_assignment | Original and candidate identities, item keys, assignment/evidence/ambiguity | No completed state with unaccounted items; independently staged activation |
| account_erasure / erasure_request / erasure_item | Request, authority/basis, target-domain cursor, disposition, payload/field receipt | Secrets/private rows removed in bounded pages; public attribution policy recorded |
| erasure_ledger / restore_frontier | Monotonic durable receipt, affected payload/literal domain, acknowledged frontier | Restore must reach required frontier before serving; no erased plaintext in ledger |

## D14. Sources, jobs, quotas and operations

| Relation family | Keys / fields | Contract / access |
| --- | --- | --- |
| source_provider / budget | Provider id, contract/surface registry, admission/rate policy | Bounded control data; source budget is operational, not trust priority |
| source_record | Provider,namespace,key UQ; current observation index | Key qualified by record type/namespace; redirects separately recorded |
| source_observation / snapshot_bundle / part | Record,observation; surface/contract, source revision, outcome, coverage, manifest/payload | Repeated payload can be distinct observations; bundle completeness explicit |
| source_mapping_claim / binding_revision | Record/local key,target native REF, mapping contract, approval, epoch | Many-to-many allowed; binding cannot silently transfer native history |
| source_subscription / check_plan / receipt | Subscriber/scope, binding, policy/epoch, scheduling and durable cursor | No timer/consumer per source row required; provider fetch can serve many indexed subscribers |
| source_redirect / resolution | Source record,observation,original/resolved target, state | Native merge requires separate decision |
| source_adoption_proposal / dependency | Proposal/part, exact source/native revisions, dependency outcome, authority epoch | Complete prerequisite set before activation; unknown dependencies not fabricated |
| source_field_journal / source_application / change | Target/slot/occurrence, input and mapping revision, expected native head, human epoch, operation receipt | Same-value human takeover represented; compensation only undoes still-owned changes |
| component/profile/name/structure source correspondence | Owner/child/exact revision, source record/local key/observation | Retain precise source occurrence across reorder, merge, split and repeated application |
| source_fanout / staged_application / chunk | Source event,target shard/cursor,generation,manifest prefix | Bounded fan-out and work; final activation checks complete generation |
| operational_outbox | Operation/event id, aggregate REV, type/schema, bounded payload/receipt | Committed with business state; time retention cannot pass unacknowledged recovery policy silently |
| task_intent / job_state | Task id,type,target,phase,cursor,lease deadline,token,epoch,state | Lease token checked on every page commit; poison jobs enter action-required/dead-letter state |
| application_receipt | Consumer,semantic operation UQ; result/cursor, commit operation | Effect and receipt atomically committed; retry retains identity |
| relay_pending / consumer_checkpoint | Relay/consumer partition, acknowledged/persisted frontier | Stale/expired frontier requires reconciliation, not silent resume |
| operational_capacity / admission_reservation | Work class/provider/shard, finite permits/bytes, expiry, state | Atomic reserve/settle/release; no unbounded queue admission |
| api_quota_policy/revision/binding/override | Policy id/revision; account/token binding; periods/caps | Versioned policy; canonical token/account scope; no plaintext token |
| api_quota_rate_state / daily_usage / request_lease / creation_reservation | Account/token/bucket/window keys, consumed/reserved units, lease operation | Concurrent reservations bounded; completion and expiry idempotent; account-erasure indexes |

## D15. Search, recommendations and other projections

| Relation family | Keys / fields | Authority / access |
| --- | --- | --- |
| unit_search_document / candidate / language index | Target REF, scope, language, current content/semantic REV, generation, searchable fields | Rebuildable; policy filter at disclosure; selected inverted and typed indexes only |
| named-form / identifier / effective-fact search | Native keys + source REV/generation and normalized predicate | One semantic source; projection never edited as a fact |
| recommendation_snapshot / partition | Snapshot/partition, input cut, algorithm version, cursor, completeness | Atomic active generation switch only after all partitions validate |
| recommendation_event/exclusion/metric | Account/REF/time event; private exclusions; aggregate inputs | Request/REF/type event dedupe; private event erasure preserves references and aggregate inputs; source scores kept identifiable |
| unit_best_score / ranking | Target/scope/algorithm generation; deterministic tie breaker | Display ranking does not change native score history |
| score/tag/reaction/reply/collection/Realm/notification/poll/conversation stats | Scope/target/metric generation and value | Recomputable, striped when hot; observed/approximate/exact meanings explicit |
| content metrics / engagement hourly | Exact content/selection REV, language/channel, coverage, algorithm/counting basis; time bucket/target | Applicable measurements, occurrence versus distinct-content semantics and coalesced generation-bound refresh; not authored state |
| studio candidates | Actor/account, concrete target, eligibility generation | Rebuildable private projection; current access required; indexed erasure |
| studio_resource_visit | PK Auth,target REF; last visited time | Private account fact; restrictive REF, monotonic completion time, current Self/account/read authority; no editor eligibility or source-order effect; indexed erasure |
| shared_search_query | Owner, query contract/AST revision, presentation | Saved query is authored data; results and counts are projections |
| export_job / export_manifest / export_part | Request, audience/authority epoch, snapshot cut, chunk hashes and cursor | Resumable bounded export; revoked authority prevents further private parts |

## D16. Future extension boundaries

These are target contracts and activation criteria, not instructions to install unused tables. They keep existing owners from being overloaded when scope expands.

| Extension | Identities / relations to add when elected | Must remain distinct |
| --- | --- | --- |
| Registry packages, plugins, skills | Package coordinate(namespace/ecosystem/name), package release/digest, manifest entry(path, exact file), declared dependency range and resolved lock target | Software project/content versus registry coordinate versus artifact versus installed instance; describing a skill grants no execution |
| Product/hardware | Product model, variant/specification, physical item, compatibility relation, condition observation | GPU chip/model/card variant/individual serial; review of model versus seller/item |
| Market/commerce | Offer(seller,target,terms), price observation(currency/tax/time), order, fulfillment, entitlement and payment ledger | Existing book/software identity stays in its owner; external source price is not entitlement; money requires its own immutable accounting rules |
| Education | Course definition, syllabus version, offering(term/institution), enrollment and learning occurrence | Course code is institution/context qualified; public catalog and private enrollment separated |
| Hosted third-party accounts | Provider/tenant account, credential, recovery, assurance and private setting boundaries when elected | Shared Entity connections and verifiable representation are selected in D02; hosting another platform's account system remains deferred |
| Compute/services | Service specification, deployment instance, capability/price observation, job/run and metering | Model/skill content versus execution versus consumed quota; log retention not content history |
| AI/3D/media extensions | Model/work identity, version, weights/mesh artifact, representation, license/use conditions | Equal bytes and different provenance/rights can remain different asset uses; deployment not model identity |

## D17. Cross-domain command contracts

| Command | Required current inputs / locks | Atomic accepted result | Failure / preservation |
| --- | --- | --- | --- |
| EditDocument | Document authority fence, branch expected head, bounded validated payload | New sealed REV, branch head, operation/outbox | Stale edit conflicts; published/adopted heads unchanged |
| PublishOrUpdate | Publisher/scope/disclosure fences, expected publication/channel head, exact dependencies | Publication REV/head plus chosen channel event | Unreadable/ungranted asset rejects; no draft-head following |
| AdoptContent | Slot/scope authority, role contract, current slot version, exact disclosure | Adoption REV/head with complete member set | Concurrent adoption cannot produce two single-slot heads |
| ImportOrRefreshComposition | Exact source revision/path, destination base head, source/base/local correspondence, current authority and operation receipt | Bounded staged pages, then sealed local occurrence manifest/head plus history/outbox | Retry reuses mappings; local edits conflict explicitly; partial results and stale workers cannot activate |
| ConvertPresentationOrWorkflow | Publication/document authority, explicit policy delta | New configuration/revision, original identities/credits | No grant from classification; historical replies retained |
| ReparentOrTransfer | Thread structure generation, relevant scopes, expected placement; staged cycle witness | New valid generation or explicit governed scope transfer | Origin unchanged; incomplete move not visible |
| ApplySource | Observation/binding/subscription/mapping versions, target local heads, human epoch, lease token | Claims/support or structural generation, journal/receipt/outbox | Same-value human change fences stale source; partial coverage cannot delete |
| RevokeAuthority | Complete bounded dependency/fence set, expected grant/admission/role/representation/installation version | New authority epoch and revocation event; dependent paths immediately unusable | Earlier locked command commits before revoke; later command rechecks; independent institutional assignments survive issuer departure |
| BindRoleOrRepresentation | Selected authority, assignment ceiling, typed recipient, target/admission revisions and ordered fences | Versioned binding or representation with explicit institutional/dependent lifecycle | No self-authorizing mutation, unrelated identity privilege union, cross-scope widening or unrooted delegation cycle |
| ConnectOrInstallApp | Verified client/subject, selected Entity, current representation, resource selection and approval revision | Private connection/consent or scope-owned installation and narrowed credential context | No name/email claim, global Principal leak, hidden consent, default retarget or client-selected installation substitution |
| CastVoteOrBallot | Eligibility/accountability, poll/scale/target version, unique voter key | Ballot/vote and receipt plus counter delta | Duplicate principal or closed poll rejected; no source vote import |
| MergeOrSplit | Current roots/epochs/visibility, reviewed exact plan, independent approvals | Resolution/assignment generation and reconciliation inventory | No incoming FK rewrite; ambiguous items stay explicit |
| EraseContentOrAccount | Erasure authority, target/payload fence, retention disposition | Durable erasure receipt, availability invalidation, staged domain items | No concealed plaintext in immutable log; blocked item observable |
| ActivateProjection | Complete validated generation, current input/security frontier | Active pointer and checkpoint | Partial generation cannot replace last good result |
| AttachOrReviseMediaUse | Subject/media authority, exact asset revision/assurance, role/applicability contract, source and human epochs | Sealed use REV and support history; gallery change only if explicitly requested | Same bytes do not merge unrelated rights; source metadata cannot confer moderation |
| SelectMediaForSlot | Slot CAS, eligible exact use REV, disclosure and context/representative witness, scoped presentation | Adoption REV/head and presentation configuration | No global primary update; invalid previous selection remains historical with explicit unavailability |
| CompleteMediaRendition | Exact input revision, transform contract, lease token, payload receipt and current erasure fence | Verified representation/location receipt and eligible availability | Stale worker or erased input cannot reactivate a cached derivative |

## D18. Relational overview

~~~mermaid
flowchart LR
    A[Owner identities] --> B[Typed catalog structures]
    A --> R[Validated reference values]
    R --> K[Claims and associations]
    S[Source observations] --> E[Evidence]
    E --> K
    K --> Q[Scope acceptance decisions]
    D[Document revisions] --> P[Social publications]
    D --> U[Content slot adoptions]
    T[Threads and placements] --> P
    R --> U
    C[Account and persona control] --> F[Authority fences and grants]
    F --> P
    F --> U
    F --> Q
    F --> M[Private messages and activity]
    Q --> X[Search and read projections]
    P --> X
    U --> X
    O[Operations and outbox] --> J[Leased jobs and receipts]
~~~

Arrows show semantic dependence, not a universal physical FK direction. The reference bridge points to concrete native owners; owner identities do not require a bridge row. Full cardinalities, keys and restrictions are specified above.

## D19. Creation and Book functional contracts

Apply the [native Work](native-work.md) and [composition](content-composition.md) contracts across creative domains using qualified domain table families. [Creation](creation.md) owns authoring/adoption flows; [native Work acceptance](../../testing/native-work.md) covers cross-domain meaning and [Book acceptance](../../testing/book-and-creation.md) covers the first product journey. No AO3-shaped namespace or duplicated effective field is required.

| Contract | Native keys and values | Required invariant |
| --- | --- | --- |
| Work metadata | Domain-native Work REF; scope/continuity, form/facets, language policy and completion | Common contract across all creative domains; metadata-only valid without fabricated source/body/release; applicable identifiers stay on their referents |
| Multilingual Work contents | Work-subject slot, language/variant dimensions, adoption REV/XREV, structure/manifest/occurrence | Multiple official/community and same-language contributions; exact selections preserve provenance, current disclosure and historical reading interpretation. |
| Composite Works, parts and releases | Independent Work/release refs; aggregation/part/correspondence roles and explicit selected occurrence coverage | Virtual/actual releases share domain contracts; each Work remains primary within its scope; no automatic identity/grant/progress inheritance |
| Source work/fandom/crossover | Association REV with created-work/source-work/grouping roles and evidence | Multiple sources allowed; membership differs from derivation and from actual ownership. |
| Character appearance and pairing | Exact relation REV, participants, Work/expression/canon and coverage | Story-specific relationships do not become global character facts; n-ary meaning preserved. |
| Co-creator and pseudonym | Native credits/name REV plus independently authorized operator/editor | Attribution is not control; privacy changes do not erase allowed contribution history. |
| Gift, dedication and creative submission | Typed relation/occurrence, intended recipient/event, visibility and declared acceptance/lifecycle | No implied rights transfer; event/collection removal does not delete the work. |
| Warnings and disclosure choice | Separate rating/warning assertion and disclosure-state values | Unknown, not-rated, no-applicable-warning and chosen nondisclosure cannot collapse into false/safe. |
| Anonymous or relinquished presentation | Target/credit visibility decision and independent control/retention transition | Never create an artificial source account or infer irreversible behavior from another platform. |

## D20. Graph API and Block query descriptors

Graph results are read projections over the D03/D11 identities and relations. [The graph contract](relationship-graph.md) owns interpretation.

| Relation/contract | Keys and fields | Invariant / access |
| --- | --- | --- |
| Relationship Graph Block descriptor | Versioned Block path/document REV; roots, predicates/roles, contexts, depth/budgets, layout/fallback | Validated native references and bounded query configuration; no embedded editable graph truth. |
| Graph cursor | Query fingerprint, scan frontier and relevant definition/topology/security generation | Incompatible filters/context cannot reuse cursor; private paths/counts are not encoded for disclosure. |
| Graph response / cache | Visible native node refs, exact relation revisions/participants, context, permitted evidence, partial/continuation | Preserve hyperedge/multiple-role semantics; current authorization gates disclosure and cache reuse. |

## D21. Hub catalog specializations

These use native software/content/assets and typed definitions; runtime execution identities are added only after [the open decisions](../../research/ai-hub-execution.md) are settled.

| Contract | Keys and fields | Invariant |
| --- | --- | --- |
| Skill content | Native software/content REF, exact Document/manifest REV, format contract, file references | Specification content remains data; paths and dependencies do not grant executable access. |
| Prompt template | Template identity, exact content REV, parameter-schema REV, example/usage revisions and intended context | Parameter/default/type meaning pinned with template; writing prompts for a creative event can use a different declared contract. |
| Registry coordinate/release | Ecosystem/namespace/name, exact artifact/manifest, source and publisher claims | Coordinate/version label differs from software and immutable artifact identity. |
| MCP endpoint and observation | Native service REF, locator, elected protocol version, auth-context class, observed capability manifest | Endpoint reachability is not full capability proof; credentials remain private and observations retain their scope. |
| Capability description | Observation/manifest-qualified tool/resource/prompt identity, parameter/resource/message contract and provenance | Distinct MCP capability families; changed observed contract cannot silently reinterpret cached descriptions. |
