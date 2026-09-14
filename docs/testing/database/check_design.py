"""Reproduce design inventories and capacity arithmetic; never connects to a database.

Use --write to refresh derived artifacts, --check to verify them. Scenario results
are specifications, not executed behavioral tests. Table declarations containing
templates are deliberately preserved as templates rather than guessed expansion.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import subprocess
from decimal import Decimal
from pathlib import Path, PureWindowsPath
from urllib.parse import unquote, urlsplit

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
ARCHITECTURE = ROOT / "docs/architecture/database"
SCHEMA = ROOT / "services/main/src/services/database/schema"
API = ROOT / "services/main/src/services/api"
SOURCE_BASELINE_COMMIT = "74079abd73d5fc43ac87ac7cae8a2074ca72d13d"

GROUPS = {
    "D01": "base columns contract-values index platform-identity slug unit-reference-columns unit-reference-consumers unit-merge catalog-identity reference-value revision-reference",
    "D02": "access access-identity access-role access-membership access-group auth participation organization-membership account-control",
    "D03": "catalog-facts catalog-definition-governance catalog-definition-terms entity",
    "D04": "catalog-names content-language unit",
    "D05": "catalog-distribution catalog-publishing catalog-program catalog-structure-history",
    "D06": "catalog-music",
    "D07": "catalog-software catalog-software-participation catalog-entity catalog-grouping catalog-reference catalog-domain-columns",
    "D08": "history image media catalog-editorial",
    "D09": "post poll",
    "D10": "realm realm-values zone content-structure content-structure-history collection collection-structure-history dock dock-history vocabulary label custom-theme entity-presentation",
    "D11": "account-block account-preference favorites follow progress reaction score tag tag-path tag-expression",
    "D12": "communication governance-delivery",
    "D13": "governance",
    "D14": "api-quota book-chapter-draft catalog-child-source catalog-music-source catalog-music-source-job catalog-profile-source catalog-software-source catalog-source catalog-source-application catalog-source-dependency catalog-source-limits catalog-source-multipart catalog-source-owned-baseline catalog-structure-source operational-durability operational-runtime",
    "D15": "aggregate content-metric pgroonga recommendation search studio",
}
FILE_GROUP = {name: group for group, names in GROUPS.items() for name in names.split()}

SQL_GROUPS = {
    "D01": "merge-integrity native-bootstrap unit-reference-integrity reference-value revision-reference",
    "D02": "access-identity access-role access-membership access-group organization-membership participation-integrity participation-private-state unit-license-grant",
    "D03": "association-proposal-authority catalog-definition-governance catalog-definition-terms catalog-semantics-integrity realm-tag-authority",
    "D04": "catalog-name-integrity catalog-name-search catalog-editorial content-language-search",
    "D05": "catalog-distribution-integrity catalog-structure-history",
    "D06": "catalog-music-history catalog-supporting-integrity",
    "D07": "catalog-domain-integrity catalog-integrity catalog-software-context-integrity catalog-software-history catalog-software-participation-integrity",
    "D08": "history-integrity content-label-policy",
    "D09": "post-integrity",
    "D10": "content-structure-budgets custom-theme-integrity realm-publication-governance",
    "D11": "account-tag-reference participation-follow participation-progress tag-judgment-aggregates tag-path unit-state-read platform-aggregates",
    "D12": "governance-delivery participation-messages participation-notifications",
    "D13": "governance-integrity",
    "D14": "catalog-child-source catalog-credit-integrity catalog-profile-source catalog-source-application catalog-source-correspondence catalog-source-dependency catalog-source-integrity catalog-source-multipart catalog-source-owned-baseline catalog-source-support catalog-structure-source music-release-source-job music-source-lifecycle operational-durability operational-runtime",
    "D15": "content-metrics participation-studio recommendation-build search-document-support unit-search-document tag-path-search",
}
SQL_GROUP = {name: group for group, names in SQL_GROUPS.items() for name in names.split()}
OVERLAY_GROUP = {
    "recommendation_exclusion_reference_values.pre": "D15",
    "following_reference_values.pre": "D11",
    "studio_visit_reference_values.pre": "D15",
}


DISPOSITIONS = {
    "D01": "Preserve owner identity; introduce normalized validated reference values; explicit correction/address history.",
    "D02": "Retain dedicated private/control domain; integrate authority fences and exact disclosure contracts.",
    "D03": "Reshape into immutable claims/evidence/decisions and identified n-ary relations; preserve native semantics.",
    "D04": "Retain typed names/languages/identifier claims; separate editorial body selection and current display preference.",
    "D05": "Retain specialized catalog grain and fields; apply common sealed-manifest and provenance protocol.",
    "D06": "Retain specialized music structures; complete exact revision/correspondence and source lifecycle contracts.",
    "D07": "Retain native owner and specialized capabilities; make classification and source contexts explicit.",
    "D08": "Reshape body/history into Document revisions; retain media identity with contextual uses, representations, locations and scoped selection.",
    "D09": "Replace overloaded post kind/root assumptions with publication, slots, origin and placement; retain poll invariants.",
    "D10": "Retain realm/zone/structure/curation/theme ownership; bind exact revisions, scopes and generations.",
    "D11": "Retain dedicated participation facts; explicit scope/actor uniqueness, provenance and versioned progress.",
    "D12": "Retain private conversation and recipient-delivery domains; versioned content, audience and watermark contracts.",
    "D13": "Retain rule-backed governance and reversals; complete split/erasure/correction contracts.",
    "D14": "Unify source journal/staging/fencing/receipts; retain quotas, transport intent and specialized data adapters.",
    "D15": "Separate authoritative private/event facts from rebuildable projections; enforce input/security generations and qualify capacity/stability.",
}

API_GROUPS = {
    "D01": "slug-addresses unit-resources",
    "D02": "participation platform-access platform-users token-info tokens users",
    "D03": "association-proposals domain-extensions",
    "D05,D06,D07,D14": "catalog",
    "D08": "history image-assets",
    "D09": "polls posts reviews wiki-navigation",
    "D10": "collections content-structure custom-themes docks realms unit-presentations units",
    "D11": "favorites progress reactions tags",
    "D12": "messages notifications",
    "D13": "audit governance reports",
    "D14": "health quota-policies schema",
    "D15": "feed recommendations search",
}
API_GROUP = {name: group for group, names in API_GROUPS.items() for name in names.split()}

# id | interacting domains | setup / operation | required result | invariants
CASES = """
S001|identity,content|Create equal text under independent authors and rights|Distinct Document identities; optional compatible payload dedupe only|I02,I14
S002|identity,classification|Correct novel classification to interactive fiction|Preserve referent; validate added software capability separately|I02,I14
S003|identity,access|Classify an object as administrator or creator|No participation or permission is granted|I05,I14
S004|identity,correction|Unknown reference referent later requires a different owner|Explicit correction/relocation and retained original references/history|I01,I02,I07
S005|reference,concurrency|Two commands allocate a bridge for one owner target|Unique target winner reused; no duplicate reference values|I01,I09
S006|reference,history|Try to retarget an existing bridge or exact revision pointer|Reject mutation; create distinct reference if needed|I01,I02
S007|address,concurrency|Two subjects claim the same normalized scoped slug|One winner; no overwritten canonical address|I01,I09
S008|address,privacy|Resolve a formerly public slug after target becomes private|Current policy enforced; no private title or identity leak|I05
S009|content,publication|Edit comment r1 into long article r2|Same Document/Publication; new revisions and presentation|I02,I07
S010|content,access|Enable collaborative editing and later disable it|Explicit policy change; earlier contributor history retained|I02,I05
S011|publication,adoption|Realm A uses r2 while author publishes r3|A stays at r2 until its authorized selection changes|I03,I04
S012|adoption,concurrency|Two editors select different revisions for one single slot|One head with conflict/stale response; never two effective bodies|I03,I08
S013|adoption,identity|Create duplicate slots with null language dimensions|Canonical uniqueness rejects semantic duplicate|I03
S014|adoption,structure|Use same revision twice in a multi-item role|Distinct occurrences preserved when role permits repetition|I07,I14
S015|content,publication|Save private draft after publishing an earlier version|No public/head-follow leak|I04,I05
S016|content,concurrency|Two users edit from the same branch version|CAS conflict or explicit merge; no silent lost update|I02,I08
S017|content,history|Append a parent to an already sealed revision|Reject; sealed DAG remains unchanged|I02,I08
S018|content,rights|Fork a quoted comment into an independent article|New lineage and exact derivation; no invented permission/endorsement|I02,I05,I14
S019|content,language|Two independent translations share a language tag|Both remain representable without language uniqueness collision|I02,I14
S020|content,assets|Publish body with a private transitive embedded image|Reject or explicitly grant exact dependency before activation|I04,I05
S021|publication,sharing|Create image-only poll-only or pure external share|No fabricated empty text Document; typed items retained|I01,I14
S022|publication,realm|Repost identical content into another Realm|Distinct publication context; content reuse does not copy votes|I05,I09,I14
S023|thread,history|Promote a reply to a new topic|Keep utterance/original target; create new Thread and placement|I02,I07
S024|thread,governance|Remove the root publication of a large discussion|Authorized tombstone; no cascade deletion of other authors|I05,I07
S025|thread,source|Import missing or unknown parent and later resolve it|Unknown never becomes implicit root; append resolution evidence|I01,I07
S026|thread,structure|Concurrent reparent operations could create a cycle|One serialized valid generation or staged rejection|I08,I12
S027|thread,access|Move private discussion into a public scope|Dedicated transfer checks; no placement-based disclosure|I04,I05
S028|thread,content|Reply to a paragraph that is removed in a later edit|Exact old anchor retained; new mapping explicit or unresolved|I02,I07
S029|source,facts|Source A and source B disagree on a single value|Both claims retained; scoped decision or conflict|I03,I06
S030|source,human|Human saves exactly the current source value|Independent confirmation and human epoch advance|I06,I10
S031|source,concurrency|Source job races with same-value human confirmation|Stale epoch blocks overwrite/compensation|I06,I10
S032|source,withdrawal|One source withdraws while another or human still supports|Only withdrawing source support changes|I06
S033|source,coverage|Narrow API response omits fields formerly seen in a dump|No omission-driven deletion without complete authoritative coverage|I06,I13
S034|source,identity|Provider redirects a source record|Native identities and grants stay unchanged absent separate decision|I02,I05,I07
S035|source,replay|Observe values A then B then A with distinct observation IDs|Causal histories retained despite equal payload hashes|I02,I06
S036|source,structure|Unstable local child key is reused after reorder|Observation-qualified correspondence; conflict rather than alias|I01,I07
S037|source,jobs|Worker crashes after page commit before ACK|Receipt prevents duplicate effect; resume from committed cursor|I10
S038|source,leases|Old worker resumes after another lease token activates|Every stale page/activation rejected|I10
S039|source,access|Pause subscription or revoke importer while staging|Activation rechecks current epochs and is denied|I05,I10
S040|source,statistics|Import upstream users votes and public score aggregates|No native account/ballot fabrication; statistics stay source-qualified|I09,I13,I14
S041|source,export|Map unsupported elected source field|Explicit unresolved/native/raw-only/excluded disposition and evidence|I13
S042|facts,time|Conflicting exact accepted intervals overlap|Reject timeline activation or record unresolved conflict|I03,I08
S043|facts,values|Store zero false empty unknown absent and not-observed|All meanings remain distinguishable in query/export|I13
S044|facts,definitions|Upgrade definition with changed semantic meaning|New identity or explicit migration; old values not reinterpreted|I02,I13
S045|relations,context|Same participants interact twice or play multiple roles|Distinct relation/participant occurrences; no tuple collapse|I07,I14
S046|relations,query|Query actor and character from unrelated voice-credit records|Must match one association revision; no false joined relation|I01,I14
S047|relations,classification|Retire a capability required by an accepted relation|Advance capability epoch; dependent current view pending review|I02,I05,I13
S048|names,authority|Change text of a name previously approved as official|New name revision needs independent authority selection|I02,I05
S049|names,identifier|Different records claim the same ISBN or source identifier|Collision candidates retained unless namespace authority proves unique|I01,I13
S050|music,structure|Recording appears several times on several discs|Distinct track occurrences and printed credits|I07,I14
S051|music,source|Observe medium but no tracklist data|Unknown/partial tracklist; never complete zero tracks|I13,I14
S052|music,catalog|Import pseudo-release or incomplete release candidate|Alternative presentation/candidate; no fabricated issued product|I13,I14
S053|publishing,language|Paperback and hardcover share text; translation differs|Separate publication specifications and appropriate text identities|I14
S054|software,source|VNDB staff edition key changes across observations|Native contribution context with stable correspondence; no fake version|I07,I14
S055|distribution,rights|Bundle book game and soundtrack with repeated member|Typed repeated occurrences; no inherited entitlement or ownership|I05,I07,I14
S056|structure,progress|Reorder chapters after a reader records progress|Old position pins old manifest; explicit mapping/unknown|I07,I14
S057|structure,scale|Stage millions of members and fail before seal|Bounded chunks; previous head intact; resumable/cancellable|I08,I10,I12
S058|grouping,context|Same character has incompatible facts in different canons|Contextual claims coexist; Realm governance not canon identity|I03,I14
S059|account,entity|Import a person whose name matches a registered account|No automatic control/recovery binding|I05,I14
S060|account,delegation|One principal uses several delegated personas to vote|Feature accountability key enforces intended uniqueness|I09
S061|account,ownership|Delete the last controller of an acting organization|Explicit recovery/transfer state; no orphan implicit superuser|I05,I09
S062|access,concurrency|A write waits while permission is revoked|Reload under current snapshot/fence; cannot commit stale authority|I05,I08
S063|access,search|Index retains an item after access is restricted|No title/snippet/facet/count disclosure via stale projection|I05
S064|access,history|Old private revision is reachable by exact URL|Current exact disclosure and history policy still enforced|I04,I05
S065|governance,rules|Rules change while a moderator submits a decision|Pin/revalidate allowed current source; reject stale basis|I05,I08
S066|governance,concurrency|Two moderators reverse the same decision|One exact reversal; second cannot duplicate effect|I09,I10
S067|governance,source|Source reports NSFW but community/human rating differs|Policy decision explicit; no automatic conflation of rating/display safety|I06,I14
S068|tags,spoilers|Concealment mark used for a puzzle punchline|No derived spoiler vote or content rating|I13,I14
S069|tags,inference|Rule rebuild fails after half the subjects|Keep prior generation; direct tag applications unchanged|I08,I10
S070|poll,concurrency|Change option meaning after votes; race close against vote|Meaning frozen/new epoch; close and acceptance serialize|I08,I09
S071|ratings,publication|Convert or repost a review with votes and a score|Target histories explicit; no automatic duplicate/transfer of score|I07,I09
S072|messages,access|New member joins private conversation with old messages|Declared visibility interval enforced; no default all-history grant|I05
S073|messages,blocking|Blocked sender or departed member retries a send|Current membership/block policy denies new effect|I05,I10
S074|messages,content|Reference a private message body from public publication|No public disclosure without separate authorized exact grant|I04,I05
S075|notification,concurrency|Mark-all races with delivery having an old timestamp|Late-committed delivery remains unread under watermark protocol|I08,I09
S076|notification,external|Email provider accepted request but reply was lost|Uncertain outcome reconciled/idempotent retry; no exactly-once claim|I10
S077|account,erasure|Erase account with public edits favorites and messages|Private data cleaned by domain policy; public provenance appropriately redacted|I05,I11
S078|content,erasure|Erase sensitive name or inline assertion literal|Value availability erased; no secret retained in audit/index|I11,I13
S079|assets,gc|New reference races with garbage collection|Storage fence/grace and final reference recheck prevent live deletion|I08,I11
S080|backup,erasure|Restore snapshot made before an erasure request|Replay independent erasure frontier before any public traffic|I11
S081|merge,concurrency|Two competing merges use roots that change while waiting|Revalidate root epochs under ordered locks; no cycle|I01,I08
S082|split,history|Undo merge after later edits mixed both referents|Assignment case with ambiguity; no fabricated automatic reconstruction|I02,I07,I13
S083|quota,concurrency|Parallel requests reserve final remaining quota units|Atomic reservations bound admission; settlement idempotent|I09,I10
S084|jobs,transport|Consumer checkpoint predates retained event frontier|Bounded reconciliation/rebuild; no silent event loss|I10,I12
S085|recommendation,recovery|Restart during second snapshot build|First snapshot remains active until complete validated activation|I08,I10
S086|export,privacy|Revoke requester during multi-part private export|Stop new disclosure; retained parts/access URLs follow revocation contract|I05,I13
S087|capacity,search|Very selective filter under huge full-text candidate set|Budgeted plan and continuation; no unbounded fill-page scan|I12
S088|capacity,hotspot|Millions of replies or votes address one target|No per-write full closure or single exact-global-counter bottleneck|I09,I12
S089|theme,execution|Approved external-live theme fetches changed dependencies|Observed approval is not transitive sealing; kill/eligibility checked|I04,I05
S090|extensions,identity|Software becomes sellable or executable|Offer/execution capability added explicitly; original native identity retained|I05,I14
S091|publication,adoption,erasure|Author withdraws comment also adopted by two Realms|Each publication/adoption and disclosure right evaluated; erasure invalidates affected payloads|I04,I05,I11
S092|source,merge,access,jobs|Binding is rebound during merge while stale importer retries|Original correspondence preserved; binding/target/authority/token fences block stale apply|I05,I06,I07,I10
S093|classification,relations,search|Class correction invalidates relation and indexed facets|Current dependencies pending review; old evidence readable only under policy|I02,I05,I13
S094|account,messages,notification,backup|Erased account returns via old backup and redelivered event|Erasure frontier plus consumer/account epochs prevent resurrection/delivery|I05,I10,I11
S095|schema,partition,identity|Hash-partition a global directory without target routing in unique key|Reject physical design; no claimed global uniqueness across partitions|I01,I09
S096|export,restore,source|Roundtrip native graph with unknowns repeated occurrences and suppressed fields|Preserve allowed semantic distinctions and explicit unavailable states|I07,I11,I13,I14
S097|thread,concurrency,projection|A new reply commits while a bulk layout generation is built|Catch up committed topology deltas before fenced switch or postpone activation|I07,I08,I10
S098|rights,history|End one license offering while another remains recognized|Independent offerings/history retained; recognition cannot reopen an ended row|I02,I05,I14
S099|facts,source,native|Human updates a typed native field also maintained by source mapping|One owning command updates decision and effective column atomically; no second writer|I03,I06,I08
S100|adoption,access,restore|Restore historical adoption after its disclosure or role eligibility is revoked|New selection revalidates and fails safely; history does not grant current use|I03,I04,I05
S101|media,catalog,language|Attach front back booklet and screenshots to two language-specific releases|Separate contextual uses; Work gallery retains each release origin|I07,I13,I14
S102|media,representation|Store original and three resized or re-encoded files|One asset revision with several representations; no extra covers|I02,I14
S103|media,identity|Import similar scans or photos with different provenance|No automatic asset identity merge based on perceptual similarity|I02,I14
S104|media,roles|One image has front and spine roles or is reused by several subjects|Versioned compatible role sets and independent contextual uses|I07,I14
S105|media,source,selection|CAA labels an image Front but does not select it as main front|Preserve role and source primary flag separately from native selection|I03,I13,I14
S106|media,grouping,catalog|Choose release art as a release-group or Work representative|Selection records eligible relationship and original release use|I01,I07,I14
S107|media,software,source|VNDB bundle image applies to one VN and all release languages|Preserve VN subset and explicit all_release_languages interpretation|I01,I13,I14
S108|media,source,coverage|Image array is absent in a narrow or failed observation|Do not withdraw unobserved gallery associations|I06,I13
S109|media,source,human|Source removes image also independently accepted by a maintainer|Retract source support; separately evaluate retained authorized use|I05,I06
S110|media,selection,access|Currently selected cover becomes unavailable|Retain selection history; return unavailable or perform authorized eligible fallback|I03,I04,I05
S111|media,presentation|Two Realms crop the same image differently|Adoption-specific presentation; shared asset and other selection unchanged|I02,I07
S112|media,selection,concurrency|Two editors set different default covers for the same canonical slot|One CAS-protected head; gallery remains multi-image|I03,I08
S113|media,storage,rights|Identical bytes appear in incompatible retention domains|No rights/existence leak or cross-domain lifetime extension through dedupe|I05,I11,I14
S114|media,external,history|External URL serves different bytes after observation|New observation/revision or stale state; never silently mutate a pinned byte-exact representation|I02,I13
S115|media,privacy,erasure|Suppress original while thumbnail or poster cache remains|Current disclosure and erasure invalidate every affected delivery path|I04,I05,I11
S116|media,video,audio|Attach subtitles audio tracks poster and a timed excerpt|Exact source revisions and typed channel/timebase selectors retained|I01,I13,I14
S117|media,publishing|Store booklet as PDF plus selected page previews|Document/page and image representations remain distinguishable|I01,I14
S118|media,scale|List gallery containing millions of historical uses|Subject/scope keyset access and bounded hydration; no eager full count|I12
S119|media,ingestion,capacity|Index external asset metadata without downloading bytes|Explicit locator/provider assurance and cache policy; no fabricated digest|I02,I12,I13
S120|media,moderation,source|Import image risk votes and source approval|Source statistics/evidence stay separate from native rating and moderation|I05,I09,I13
S121|media,language,source|Release gains a language after an all-language image observation|Reevaluate relative applicability with pinned context before changing current selection|I02,I03,I13
S122|media,version,adoption|Replace image content or revise use after it is adopted|Old adoption pins old use and asset revisions until explicit advance|I02,I03
S123|media,erasure,fanout|Erase asset referenced by many uses and default selections|Immediate delivery invalidation and bounded reconciliation of affected uses|I05,I11,I12
S124|media,jobs,concurrency|Old transform worker completes after input erasure or replacement|Lease and erasure/input fences reject stale rendition activation|I05,I10,I11
S125|ratings,context,history|Correct one daily observation then intentionally record another day or experience|Revision observation and context identities remain distinct; UI and API expose the action|I02,I07,I09
S126|ratings,aggregation|A records 2 2 8 and B records 6 under one context|Latest-per-rater 7; mean-per-rater 5; pooled observations 4.5 with explicit denominators|I09,I13
S127|ratings,time,concurrency|Retry or race a same-day vote across DST and persona switches|Server period and private accountability key admit one observation; retry preserves receipt|I05,I09,I10
S128|ratings,privacy,recovery|Withdraw latest score while a histogram rebuild and restore are pending|No old-score resurrection or hidden-count leakage; revision deltas and privacy frontier survive replay|I05,I10,I11
S129|classification,event,time|Two named topic Tags denote one event with a month-only occurrence date|One date authority and deduplicated event; possible day match differs from exact duration|I01,I03,I13
S130|event,query,source|Correct actual date while querying Tag and participant roles with an old cursor|One accepted relation revision; actual planned recorded times separate; generation restart explicit|I03,I08,I12,I13
S131|ratings,event,capacity|Query a large per-rater range and dense event-date overlap|Bounded candidate work or resumable exact job; no averaging daily means or full-corpus foreground scan|I09,I12
S132|ratings,context,policy|Change aggregation default then change the evaluation question|Default versions policy without new observations; changed meaning requires explicit new context|I02,I09,I13
"""

# scenario, row role, multiplier per scenario root, heap bytes, index bytes,
# externally stored payload bytes. Widths and multiplicities are assumptions.
FAMILIES = [
    ("catalog", "owner_identity", "1", 224, 160, 0),
    ("catalog", "reference_value", "1.2", 112, 216, 0),
    ("catalog", "license_offering_history", "2.4", 160, 176, 0),
    ("catalog", "access_and_ownership", "0.25", 144, 176, 0),
    ("catalog", "name_and_identifier_current", "6", 208, 176, 0),
    ("catalog", "name_and_identifier_revision", "12", 256, 112, 0),
    ("catalog", "fact_slot_and_head", "10", 160, 144, 0),
    ("catalog", "assertion", "16", 256, 160, 0),
    ("catalog", "assertion_support", "24", 112, 128, 0),
    ("catalog", "acceptance_decision", "12", 160, 112, 0),
    ("catalog", "decision_member", "16", 96, 128, 0),
    ("catalog", "association_identity", "3", 112, 96, 0),
    ("catalog", "association_revision", "4.5", 160, 112, 0),
    ("catalog", "association_participant", "13.5", 144, 192, 0),
    ("catalog", "structural_occurrence", "6", 192, 160, 0),
    ("catalog", "native_component_revision", "5", 320, 128, 0),
    ("catalog", "source_record_and_binding", "2", 224, 176, 0),
    ("catalog", "source_observation", "6", 192, 128, 2048),
    ("catalog", "source_journal_and_correspondence", "16", 240, 192, 0),
    ("catalog", "revision_reference", "3", 112, 144, 0),
    ("catalog", "search_projection", "1.5", 320, 640, 0),
    ("catalog", "operation_audit_receipt", "5", 224, 128, 0),
    ("social", "document", "0.9", 160, 112, 0),
    ("social", "document_variant_branch", "0.9", 144, 128, 0),
    ("social", "document_revision", "1.17", 224, 128, 1024),
    ("social", "revision_parent", "0.27", 96, 96, 0),
    ("social", "publication_identity_and_head", "1", 256, 208, 0),
    ("social", "publication_revision", "1.4", 144, 112, 0),
    ("social", "publication_item", "1.54", 128, 144, 0),
    ("social", "reference_value", "1.2", 112, 216, 0),
    ("social", "exact_reference_and_disclosure", "1.5", 176, 144, 0),
    ("social", "thread_and_topic", "0.15", 208, 144, 0),
    ("social", "thread_placement", "1.05", 176, 224, 0),
    ("social", "reply_origin_and_target", "0.7", 128, 144, 0),
    ("social", "content_slot_and_adoption", "0.01", 352, 256, 0),
    ("social", "reaction_rating_ballot_tag", "8", 112, 176, 0),
    ("social", "notification", "3", 256, 224, 0),
    ("social", "operation_audit_receipt", "2", 224, 128, 0),
    ("social", "governance_case_action", "0.01", 384, 208, 0),
    ("social", "search_projection", "1", 320, 640, 0),
    ("social", "favorite_follow_progress", "2", 144, 176, 0),
    ("messages", "conversation_and_membership", "0.1", 256, 224, 0),
    ("messages", "message", "1", 192, 176, 0),
    ("messages", "message_revision", "1.1", 208, 112, 1024),
    ("messages", "recipient_state", "0.2", 112, 112, 0),
    ("messages", "message_delivery", "1", 176, 160, 0),
    ("messages", "message_operation_receipt", "1.1", 176, 112, 0),
    ("media", "media_asset", "3.2", 160, 112, 0),
    ("media", "media_asset_revision", "3.36", 208, 144, 0),
    ("media", "original_representation", "3.36", 192, 160, 2_000_000),
    ("media", "preview_representation", "6.72", 192, 160, 150_000),
    ("media", "asset_location", "12.6", 240, 144, 0),
    ("media", "asset_use", "4", 160, 144, 0),
    ("media", "asset_use_revision", "4.4", 224, 160, 0),
    ("media", "asset_use_role", "5.5", 80, 96, 0),
    ("media", "asset_use_applicability", "8.8", 128, 144, 0),
    ("media", "media_source_support", "6.6", 160, 144, 0),
    ("media", "media_gallery_occurrence", "4", 144, 176, 0),
    ("media", "media_selection_history", "2.6", 176, 144, 0),
    ("media", "media_current_selection", "2", 112, 112, 0),
    ("ratings", "rating_context_revision", "0.001", 256, 160, 0),
    ("ratings", "rating_observation", "1", 192, 128, 0),
    ("ratings", "rating_revision", "1.25", 176, 96, 0),
    ("ratings", "rating_effective_head", "1", 160, 128, 0),
    ("ratings", "rating_rater_summary", "0.1", 160, 112, 0),
    ("ratings", "rating_rater_day_summary", "0.8", 160, 144, 0),
    ("ratings", "rating_day_histogram", "0.02", 224, 128, 0),
    ("event_time", "event_identity_profile", "1", 224, 160, 0),
    ("event_time", "event_temporal_claim_revision", "2", 176, 112, 0),
    ("event_time", "event_temporal_projection", "1.5", 128, 192, 0),
    ("event_time", "event_topic_binding", "0.25", 96, 128, 0),
]


def tsv(fields, rows):
    out = io.StringIO(newline="")
    writer = csv.DictWriter(out, fieldnames=fields, delimiter="\t", lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return out.getvalue()


def inventory():
    rows = []
    for p in sorted(SCHEMA.rglob("*")):
        if p.suffix not in {".ts", ".sql"} or p.name.endswith(".test.ts"):
            continue
        if p.parent.name == "postgres":
            group = "D01" if p.stem == "manifest" else SQL_GROUP.get(p.stem)
        elif p.parent.name == "migration-overlays":
            group = OVERLAY_GROUP.get(p.stem)
        else:
            group = FILE_GROUP.get(p.stem)
        if group is None:
            raise ValueError(f"Unreviewed schema owner: {p.relative_to(ROOT)}")
        data = p.read_text(encoding="utf-8")
        tables = re.findall(r"pgTable\(\s*['\"`]([^'\"`]+)['\"`]", data)
        if p.suffix == ".sql":
            tables = re.findall(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w.]+)", data, re.I)
        rows.append({
            "source_file": p.relative_to(ROOT).as_posix(),
            "dictionary_group": group,
            "declared_tables_or_templates": "; ".join(tables) or "helper/guard/manifest; inspect owning source",
            "disposition": DISPOSITIONS[group],
            "source_sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
        })
    api_rows = []
    for p in sorted(API.iterdir()):
        if not p.is_dir():
            continue
        if p.name not in API_GROUP:
            raise ValueError(f"Unreviewed API owner: {p.name}")
        api_rows.append({
            "api_owner": p.name, "dictionary_groups": API_GROUP[p.name],
            "disposition": "Retain endpoint responsibility; implement the referenced target contracts without implied old-wire compatibility.",
        })
    return rows, api_rows


def scenarios():
    rows = []
    for line in CASES.strip().splitlines():
        case, domains, setup, expected, invariants = line.split("|")
        rows.append({"id": case, "domains": domains, "setup_and_operation": setup,
                     "required_outcome": expected, "invariants": invariants,
                     "verification_status": "specified; real SQL/stateful/concurrency execution pending"})
    ids = [r["id"] for r in rows]
    assert len(ids) == len(set(ids))
    used = {i for r in rows for i in r["invariants"].split(",")}
    assert used == {f"I{i:02}" for i in range(1, 15)}
    return rows


def capacity():
    rows = []
    totals = {}
    for scenario, name, factor, heap, indexes, payload in FAMILIES:
        for roots in (500_000_000, 3_000_000_000):
            count = int(Decimal(factor) * roots)
            native = count * (heap + indexes)
            objects = count * payload
            row = {"scenario": scenario, "row_role": name, "scenario_roots": roots,
                   "rows_per_root": factor, "modeled_rows": count,
                   "heap_bytes_per_row": heap, "index_bytes_per_row": indexes,
                   "external_payload_bytes_per_row": payload,
                   "native_bytes": native, "external_payload_bytes": objects,
                   "standalone_500m_rows_native_bytes": 500_000_000 * (heap + indexes),
                   "standalone_3b_rows_native_bytes": 3_000_000_000 * (heap + indexes)}
            rows.append(row)
            total = totals.setdefault((scenario, roots), {"native": 0, "payload": 0, "rows": 0})
            total["native"] += native
            total["payload"] += objects
            total["rows"] += count
    for scenario in {f[0] for f in FAMILIES}:
        low = totals[(scenario, 500_000_000)]
        high = totals[(scenario, 3_000_000_000)]
        assert all(high[k] == 6 * low[k] for k in low)
    lines = ["# Capacity model: assumptions and reproducible arithmetic", "",
             "Generated by check_design.py. All widths, densities, throughputs and retention windows below are planning assumptions. No PostgreSQL size, benchmark or restore time was measured.", "",
             "The catalog scenario counts native catalog roots; social counts publications; messages counts messages; media counts media-bearing subjects; ratings counts observations; event_time counts concrete events. These are separate synthetic mixes, not the same number of all REZICS records. Do not add scenario totals without deciding the actual mix and deduplicating shared identity/reference/revision/audit/selection rows. The [temporal envelope](temporal-capacity.md) defines rating/event densities, sparse-tail sensitivity, concurrency, query budgets and recovery obligations.", "",
             "A modeled row role groups comparable rows across owner tables. Composite roles are equivalent-row estimates, not an assertion that several physical rows fit into one row. Inspect the dictionary and split composite roles using measured widths before implementation sizing. Every role also has an independent 500M/3B-row calculation in capacity.json. Control/configuration tables require an explicit bounded deployment inventory instead of automatically allocating 500M rows.", "",
             "## Scenario totals", "",
             "| Scenario | Roots | Modeled rows | Native heap + indexes TB | External payload TB | Native provision at 2x TB | Native + one replica at 2x each TB | 250 MB/s native restore lower bound hours |",
             "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"]
    for (scenario, roots), total in sorted(totals.items()):
        native = total["native"]
        lines.append(f"| {scenario} | {roots:,} | {total['rows']:,} | {native / 1e12:.3f} | {total['payload'] / 1e12:.3f} | {native * 2 / 1e12:.3f} | {native * 4 / 1e12:.3f} | {native / 250_000_000 / 3600:.2f} |")
    lines += ["", "Native provision uses a 2x free-space/bloat/rebuild allowance, separately for each copy. It is not a predicted bloat ratio. Backups, retained WAL, object-store replicas, object inventory, search-engine external files and dual-generation migration space are additional. The restore bound assumes transferring heap AND indexes at constant effective 250 MB/s; rebuilding indexes from a smaller backup instead trades transfer for compute and I/O. Both bounds exclude WAL replay and validation.", "",
              "## Per-role expansion", "",
              "| Scenario | Row role | Rows/root | Heap B | Index B | External B | 500M roots native TB | 3B roots native TB | Independent 500M rows GB | Independent 3B rows TB |",
              "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"]
    for scenario, name, factor, heap, indexes, payload in FAMILIES:
        width = heap + indexes
        lines.append(f"| {scenario} | {name} | {factor} | {heap} | {indexes} | {payload} | {float(Decimal(factor) * 500_000_000 * width) / 1e12:.3f} | {float(Decimal(factor) * 3_000_000_000 * width) / 1e12:.3f} | {500_000_000 * width / 1e9:.1f} | {3_000_000_000 * width / 1e12:.3f} |")
    lines += ["", "## Media density and optional hosting", "",
              "Per media-bearing subject, assume 4 contextual asset uses, 3.2 distinct assets after authorized sharing, 1.05 content revisions per asset, and 1 original plus 2 previews per revision. Locations average 1.25 per representation. Use histories average 1.1 revisions, with 1.25 roles, 2 applicability entries and 1.5 source-support rows per use revision. Two display slots with 1.3 historical selections are modeled separately from gallery membership. These are adjustable density assumptions, not source/API limits.", "",
              "The binary envelope assumes every original is hosted at 2 MB average and every preview at 150 KB average; media External payload TB above therefore represents 100% hosting. Metadata-only indexing does not require this binary allocation. Use independent original and preview admission fractions; cached thumbnails can be common even when originals remain external. No global cross-rights-domain dedupe saving is assumed.", "",
              "| Media-bearing subjects | All originals + previews TB | 1% originals + 1% previews TB | 1% originals + 10% previews TB |",
              "| --- | ---: | ---: | ---: |"]
    for roots in (500_000_000, 3_000_000_000):
        originals = sum(r["external_payload_bytes"] for r in rows if r["scenario"] == "media" and r["scenario_roots"] == roots and r["row_role"] == "original_representation")
        previews = sum(r["external_payload_bytes"] for r in rows if r["scenario"] == "media" and r["scenario_roots"] == roots and r["row_role"] == "preview_representation")
        assert originals + previews == totals[("media", roots)]["payload"]
        lines.append(f"| {roots:,} | {(originals + previews) / 1e12:.3f} | {(originals + previews) * 0.01 / 1e12:.3f} | {(originals * 0.01 + previews * 0.10) / 1e12:.3f} |")
    lines += ["", "Binary estimates exclude object replicas, version retention, traffic, abandoned uploads, transform working space, audio/video durations/bitrates and PDF size distributions. Size those media separately; image averages cannot qualify full multimedia hosting. Gallery reads use subject/scope/rank keysets; reverse erasure traverses asset/use indexes in bounded pages. Bound fetch bytes, transform concurrency and queued storage; receipt/lease/erasure fences prevent late workers resurrecting files. Compare metadata-only, original-cache and preview-cache workloads in qualification."]
    lines += ["", "## Sensitivity and operational budgets", "",
              "Catalog assumptions are dense: 16 assertions, 24 support rows, 13.5 relation-participant revisions and 16 source journal/correspondence rows per root. Keep these separately adjustable. Doubling evidence retention does not double every domain table, but it doubles the affected row role and associated retained payloads. A social root has 0.9 Documents, 1.3 revisions per Document, 1.4 publication revisions and 3 notifications; not every publication creates a Document or Thread.", "",
              "At 100,000 source objects/day, refreshing 500M objects once takes 5,000 days and 3B takes 30,000 days. At 1,000,000/day the lower bounds are 500/3,000 days. Continuous update therefore needs source deltas, popularity/freshness policy and elected coverage, not periodic whole-corpus crawling. The 50 objects/s initial test profile is 4.32M/day if sustained; this is not a provider permission or attainable feed rate.", "",
              "At an assumed 20,000 native WAL bytes per small operation, 20 writes/s produces 0.4 MB/s or 34.56 GB/day; 100 writes/s produces 2 MB/s or 172.8 GB/day. A source application with hundreds of children can be orders of magnitude larger. Measure pg_stat_wal deltas under representative insert/update/checkpoint patterns; payload size is not WAL size.", "",
              "A hypothetical 50,000 deliveries/s retained for 30 days creates 129.6B rows, not 500M. Such a rate requires a separately qualified delivery fleet, retention policy and recipient routing. At 2,000 events/s and 72-hour retention the hot outbox/transport envelope is 518.4M events; at 512 bytes/event this is 265.4 GB logical before indexes, replication or broker overhead. Small configuration counts cannot justify corpus-sized notification or outbox costs.", "",
              "A three-billion-row relation with a 96-byte index key entry represents 288 GB of index entries before tree/page overhead beyond the estimate. Do not assume all indexes fit RAM. A 100-byte average width error costs 50 GB at 500M rows and 300 GB at 3B rows, multiplied by relation density. The identity reference bridge includes its primary key, one selected reverse index and one derived-native-ID expression index per row; it does not insert one entry into every nullable alternative index. Exact revision references retain their separate two-index estimate.", "",
              "The target is single PostgreSQL initially, but the dense catalog upper scenario cannot be certified on unspecified hardware. If restore lower bound exceeds the proposed four-hour RTO, select a warm recovery replica/snapshot strategy or revise the accepted RTO before activation. Partitioning cannot shorten transfer below available bandwidth or provide cross-node FKs.", "",
              "Qualification must measure root/child distributions, hot-key skew, serialized edits per aggregate, query candidate budgets, index/TOAST bytes, vacuum/freeze lag, logical/physical WAL, replica lag, connection and memory ceilings, queue age, erasure cost, index rebuild and restore. Primary alert thresholds and cutover actions are in README section 15."]
    return {"assumptions_only": True, "decimal_units": True, "families": rows,
            "scenario_totals": [{"scenario": s, "roots": n, **v} for (s, n), v in sorted(totals.items())]}, "\n".join(lines) + "\n"


def artifact_path(name):
    return (ARCHITECTURE if name in {"capacity.md", "capacity.json"} else HERE) / name


def design_documents():
    return sorted({
        *(p for p in ARCHITECTURE.glob("*.md") if p.name != "capacity.md"),
        *(ROOT / "docs/architecture" / name for name in (
            "product-design-principles.md",
            "identity-and-access.md", "connected-apps.md",
            "identity-and-access-experience.md", "identity-access-capacity.md",
        )),
        *(ROOT / "docs/testing").glob("*.md"),
        *(ROOT / "docs/plan").glob("*.md"),
        *(ROOT / "docs/plan/modules").glob("*.md"),
        *(ROOT / "docs/research").glob("*.md"),
    }, key=lambda path: path.relative_to(ROOT).as_posix())


def dependencies(inventory_rows, api_rows, generated_names):
    local = set()
    network = set()
    for document in design_documents():
        doc = document.relative_to(ROOT).as_posix()
        content = document.read_text(encoding="utf-8")
        for link in re.findall(r"\]\(([^)]+)\)", content):
            if link.startswith("#"):
                continue
            parsed = urlsplit(link)
            if parsed.scheme == "https":
                network.add(link)
                continue
            if parsed.scheme or parsed.netloc:
                raise ValueError(f"Unsupported external document dependency: {doc}: {link}")
            relative = unquote(parsed.path)
            if Path(relative).is_absolute() or PureWindowsPath(relative).is_absolute():
                raise ValueError(f"Machine-local document dependency: {doc}: {link}")
            target = (document.parent / relative).resolve()
            try:
                path = target.relative_to(ROOT)
            except ValueError as exc:
                raise ValueError(f"Document dependency escapes repository: {doc}: {link}") from exc
            if ".temp" in {part.lower() for part in path.parts}:
                raise ValueError(f"Temporary document dependency: {doc}: {link}")
            assert target.exists() or target in {artifact_path(name) for name in generated_names}, (doc, link)
            local.add(path.as_posix())
    return {
        "source_baseline_commit": SOURCE_BASELINE_COMMIT,
        "runtime": "Python 3.10+ standard library; Git only for optional --require-tracked",
        "network_required_for_reproduction": False,
        "local_document_dependencies": sorted(local),
        "schema_inputs": [row["source_file"] for row in inventory_rows],
        "api_owner_directory_inputs": [(API / row["api_owner"]).relative_to(ROOT).as_posix() for row in api_rows],
        "supporting_public_https_sources": sorted(network),
    }


def artifacts():
    inventory_rows, api_rows = inventory()
    cases = scenarios()
    cap, cap_md = capacity()
    outputs = {
        "current-schema-map.tsv": tsv(list(inventory_rows[0]), inventory_rows),
        "api-coverage.tsv": tsv(list(api_rows[0]), api_rows),
        "scenarios.tsv": tsv(list(cases[0]), cases),
        "capacity.json": json.dumps(cap, indent=2, ensure_ascii=False) + "\n",
        "capacity.md": cap_md,
    }
    dictionary = (ARCHITECTURE / "data-dictionary.md").read_text(encoding="utf-8")
    readme = (ARCHITECTURE / "README.md").read_text(encoding="utf-8")
    for group in {r["dictionary_group"] for r in inventory_rows}:
        assert f"## {group}." in dictionary, group
    for group in {g for r in api_rows for g in r["dictionary_groups"].split(",")}:
        assert f"## {group}." in dictionary, group
    for index in range(1, 15):
        assert f"I{index:02}" in readme
    dependency_manifest = dependencies(inventory_rows, api_rows, set(outputs) | {"dependency-manifest.json"})
    outputs["dependency-manifest.json"] = json.dumps(dependency_manifest, indent=2, ensure_ascii=False) + "\n"
    evidence = {
        "source_baseline_commit": SOURCE_BASELINE_COMMIT,
        "schema_modules_and_sql_files_mapped": len(inventory_rows),
        "api_owner_directories_mapped": len(api_rows),
        "specified_cross_domain_scenarios": len(cases),
        "invariant_families": 14,
        "capacity_row_roles": len(FAMILIES),
        "capacity_scales": [500_000_000, 3_000_000_000],
        "checks": ["all current non-test schema TS/SQL files have explicit reviewed mapping",
                   "all top-level API owner directories have explicit mapping",
                   "dictionary groups and local artifact links resolve within the repository, outside temporary directories",
                   "scenario identifiers unique and every invariant family covered",
                   "3B capacity arithmetic equals six times 500M under same assumptions"],
        "not_executed": ["target DDL or migrations", "SQL behavioral/concurrency tests", "composed formal model checking",
                         "full upstream field conformance", "load/stability tests", "backup/restore drill"],
        "sha256": {name: hashlib.sha256(data.encode()).hexdigest() for name, data in outputs.items()},
        "artifact_paths": {name: artifact_path(name).relative_to(ROOT).as_posix() for name in outputs},
        "authored_document_sha256": {path.relative_to(ROOT).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
                                    for path in [*design_documents(), Path(__file__).resolve()]},
    }
    outputs["verification.json"] = json.dumps(evidence, indent=2) + "\n"
    return outputs, evidence, dependency_manifest


def require_tracked(outputs, dependency_manifest):
    tracked = set(subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode("utf-8").split("\0"))
    required = set(dependency_manifest["local_document_dependencies"]) | set(dependency_manifest["schema_inputs"])
    for name in outputs:
        required.add(artifact_path(name).relative_to(ROOT).as_posix())
    required.update(path.relative_to(ROOT).as_posix() for path in [*design_documents(), Path(__file__).resolve()])
    missing = sorted(path for path in required if not (
        any(name.startswith(path.rstrip("/") + "/") for name in tracked)
        if (ROOT / path).is_dir() else path in tracked
    ))
    for directory in dependency_manifest["api_owner_directory_inputs"]:
        if not any(path.startswith(directory + "/") for path in tracked):
            missing.append(directory + "/ (no tracked contents)")
    if missing:
        raise SystemExit("Untracked design dependencies:\n" + "\n".join(missing))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true")
    mode.add_argument("--check", action="store_true")
    parser.add_argument("--require-tracked", action="store_true", help="Require all local inputs and package files in the Git index")
    args = parser.parse_args()
    outputs, evidence, dependency_manifest = artifacts()
    for name, data in outputs.items():
        path = artifact_path(name)
        if args.write:
            path.write_text(data, encoding="utf-8", newline="\n")
        elif not path.exists() or path.read_text(encoding="utf-8") != data:
            raise SystemExit(f"Stale/missing design artifact: {name}; rerun --write after reviewing changes")
    if args.require_tracked:
        require_tracked(outputs, dependency_manifest)
    print(json.dumps({k: v for k, v in evidence.items() if k not in {"sha256", "authored_document_sha256"}}, indent=2))


if __name__ == "__main__":
    main()
