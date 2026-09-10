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
SCHEMA = ROOT / "services/main/src/services/database/schema"
API = ROOT / "services/main/src/services/api"
SOURCE_BASELINE_COMMIT = "74079abd73d5fc43ac87ac7cae8a2074ca72d13d"

GROUPS = {
    "D01": "base columns contract-values index platform-identity slug unit-reference-columns unit-reference-consumers unit-merge catalog-identity",
    "D02": "access auth participation organization-membership account-control",
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
    "D01": "merge-integrity native-bootstrap unit-reference-integrity",
    "D02": "organization-membership participation-integrity participation-private-state unit-license-grant",
    "D03": "association-proposal-authority catalog-definition-governance catalog-definition-terms catalog-semantics-integrity realm-tag-authority",
    "D04": "catalog-name-integrity catalog-name-search catalog-editorial content-language-search",
    "D05": "catalog-distribution-integrity catalog-structure-history",
    "D06": "catalog-music-history catalog-supporting-integrity",
    "D07": "catalog-domain-integrity catalog-integrity catalog-software-context-integrity catalog-software-history catalog-software-participation-integrity",
    "D08": "history-integrity content-label-policy",
    "D09": "post-integrity",
    "D10": "content-structure-budgets custom-theme-integrity realm-publication-governance",
    "D11": "participation-follow participation-progress tag-judgment-aggregates tag-path unit-state-read platform-aggregates",
    "D12": "governance-delivery participation-messages participation-notifications",
    "D13": "governance-integrity",
    "D14": "catalog-child-source catalog-credit-integrity catalog-profile-source catalog-source-application catalog-source-correspondence catalog-source-dependency catalog-source-integrity catalog-source-multipart catalog-source-owned-baseline catalog-source-support catalog-structure-source music-release-source-job music-source-lifecycle operational-durability operational-runtime",
    "D15": "content-metrics participation-studio recommendation-build search-document-support unit-search-document tag-path-search",
}
SQL_GROUP = {name: group for group, names in SQL_GROUPS.items() for name in names.split()}

DISPOSITIONS = {
    "D01": "Preserve owner identity; introduce normalized validated reference values; explicit correction/address history.",
    "D02": "Retain dedicated private/control domain; integrate authority fences and exact disclosure contracts.",
    "D03": "Reshape into immutable claims/evidence/decisions and identified n-ary relations; preserve native semantics.",
    "D04": "Retain typed names/languages/identifier claims; separate editorial body selection and current display preference.",
    "D05": "Retain specialized catalog grain and fields; apply common sealed-manifest and provenance protocol.",
    "D06": "Retain specialized music structures; complete exact revision/correspondence and source lifecycle contracts.",
    "D07": "Retain native owner and specialized capabilities; make classification and source contexts explicit.",
    "D08": "Reshape authored body/history into Document revisions; retain media identity and separate payload availability.",
    "D09": "Replace overloaded post kind/root assumptions with publication, slots, origin and placement; retain poll invariants.",
    "D10": "Retain realm/zone/structure/curation/theme ownership; bind exact revisions, scopes and generations.",
    "D11": "Retain dedicated participation facts; explicit scope/actor uniqueness, provenance and versioned progress.",
    "D12": "Retain private conversation and recipient-delivery domains; versioned content, audience and watermark contracts.",
    "D13": "Retain rule-backed governance and reversals; complete split/erasure/correction contracts.",
    "D14": "Unify source journal/staging/fencing/receipts; retain quotas, transport intent and specialized data adapters.",
    "D15": "Retain as rebuildable projections with input/security generation; capacity/stability qualification required.",
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
"""

# scenario, row role, multiplier per scenario root, heap bytes, index bytes,
# externally stored payload bytes. Widths and multiplicities are assumptions.
FAMILIES = [
    ("catalog", "owner_identity", "1", 224, 160, 0),
    ("catalog", "reference_value", "1.2", 112, 144, 0),
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
    ("social", "reference_value", "1.2", 112, 144, 0),
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
             "The catalog scenario counts native catalog roots; social counts publications; messages counts messages. These are separate synthetic mixes, not the same number of all REZICS records. Do not add scenario totals without deciding the actual mix and deduplicating shared reference/audit rows.", "",
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
    lines += ["", "## Sensitivity and operational budgets", "",
              "Catalog assumptions are dense: 16 assertions, 24 support rows, 13.5 relation-participant revisions and 16 source journal/correspondence rows per root. Keep these separately adjustable. Doubling evidence retention does not double every domain table, but it doubles the affected row role and associated retained payloads. A social root has 0.9 Documents, 1.3 revisions per Document, 1.4 publication revisions and 3 notifications; not every publication creates a Document or Thread.", "",
              "At 100,000 source objects/day, refreshing 500M objects once takes 5,000 days and 3B takes 30,000 days. At 1,000,000/day the lower bounds are 500/3,000 days. Continuous update therefore needs source deltas, popularity/freshness policy and elected coverage, not periodic whole-corpus crawling. The 50 objects/s initial test profile is 4.32M/day if sustained; this is not a provider permission or attainable feed rate.", "",
              "At an assumed 20,000 native WAL bytes per small operation, 20 writes/s produces 0.4 MB/s or 34.56 GB/day; 100 writes/s produces 2 MB/s or 172.8 GB/day. A source application with hundreds of children can be orders of magnitude larger. Measure pg_stat_wal deltas under representative insert/update/checkpoint patterns; payload size is not WAL size.", "",
              "A hypothetical 50,000 deliveries/s retained for 30 days creates 129.6B rows, not 500M. Such a rate requires a separately qualified delivery fleet, retention policy and recipient routing. At 2,000 events/s and 72-hour retention the hot outbox/transport envelope is 518.4M events; at 512 bytes/event this is 265.4 GB logical before indexes, replication or broker overhead. Small configuration counts cannot justify corpus-sized notification or outbox costs.", "",
              "A three-billion-row relation with a 96-byte index key entry represents 288 GB of index entries before tree/page overhead beyond the estimate. Do not assume all indexes fit RAM. A 100-byte average width error costs 50 GB at 500M rows and 300 GB at 3B rows, multiplied by relation density. The reference bridge includes one selected reverse index per row; it does not insert one entry into every nullable alternative index.", "",
              "The target is single PostgreSQL initially, but the dense catalog upper scenario cannot be certified on unspecified hardware. If restore lower bound exceeds the proposed four-hour RTO, select a warm recovery replica/snapshot strategy or revise the accepted RTO before activation. Partitioning cannot shorten transfer below available bandwidth or provide cross-node FKs.", "",
              "Qualification must measure root/child distributions, hot-key skew, serialized edits per aggregate, query candidate budgets, index/TOAST bytes, vacuum/freeze lag, logical/physical WAL, replica lag, connection and memory ceilings, queue age, erasure cost, index rebuild and restore. Primary alert thresholds and cutover actions are in README section 15."]
    return {"assumptions_only": True, "decimal_units": True, "families": rows,
            "scenario_totals": [{"scenario": s, "roots": n, **v} for (s, n), v in sorted(totals.items())]}, "\n".join(lines) + "\n"


def dependencies(inventory_rows, api_rows, generated_names):
    local = set()
    network = set()
    for doc in ("README.md", "data-dictionary.md"):
        content = (HERE / doc).read_text(encoding="utf-8")
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
            target = (HERE / relative).resolve()
            try:
                path = target.relative_to(ROOT)
            except ValueError as exc:
                raise ValueError(f"Document dependency escapes repository: {doc}: {link}") from exc
            if ".temp" in {part.lower() for part in path.parts}:
                raise ValueError(f"Temporary document dependency: {doc}: {link}")
            assert target.exists() or (target.parent == HERE and target.name in generated_names), (doc, link)
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
    dictionary = (HERE / "data-dictionary.md").read_text(encoding="utf-8")
    readme = (HERE / "README.md").read_text(encoding="utf-8")
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
        "authored_document_sha256": {name: hashlib.sha256((HERE / name).read_bytes()).hexdigest()
                                    for name in ("README.md", "data-dictionary.md", "check_design.py")},
    }
    outputs["verification.json"] = json.dumps(evidence, indent=2) + "\n"
    return outputs, evidence, dependency_manifest


def require_tracked(outputs, dependency_manifest):
    tracked = set(subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode("utf-8").split("\0"))
    required = set(dependency_manifest["local_document_dependencies"]) | set(dependency_manifest["schema_inputs"])
    for name in set(outputs) | {"README.md", "data-dictionary.md", "check_design.py"}:
        required.add((HERE / name).relative_to(ROOT).as_posix())
    missing = sorted(required - tracked)
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
        path = HERE / name
        if args.write:
            path.write_text(data, encoding="utf-8", newline="\n")
        elif not path.exists() or path.read_text(encoding="utf-8") != data:
            raise SystemExit(f"Stale/missing design artifact: {name}; rerun --write after reviewing changes")
    if args.require_tracked:
        require_tracked(outputs, dependency_manifest)
    print(json.dumps({k: v for k, v in evidence.items() if k not in {"sha256", "authored_document_sha256"}}, indent=2))


if __name__ == "__main__":
    main()
