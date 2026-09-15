# Information verification acceptance

Owner: [information indexing, fact verification and acceptance](../architecture/information-indexing-and-verification.md).
The FACT/CAPFACT matrices are contract scenarios, not executed tests. The narrow
[analytical review](#analytical-performance-review) below records executed arithmetic,
not runtime acceptance. M02/M07/M09 own the verification
system; M04 participates in native adoption and M10 in optional commercial delivery.
Runtime activation and test-authoring/execution follow the [active plan](../plan/README.md)
and [execution workflow](../plan/execution-workflow.md). This specification does not
expand the current IAM scope or qualify any gate.

## Semantic and assessment cases

| ID | Scenario and required result |
| --- | --- |
| FACT01 | Index a supported external description with no native adapter or evaluator. Source queries preserve statements and unresolved mapping/assessment; no fabricated native REF or implied acceptance. |
| FACT02 | Query a broad claim view and a strict answer policy over the same inputs. Broad discovery includes admissible unverified/conflicted claims; the strict result may abstain. No silent fallback or denominator change. |
| FACT03 | Japanese digital May 1 and Traditional Chinese print June 15 claims remain distinct by release/context. Date comparison cannot merge languages, editions, planned/actual roles or calendars. |
| FACT04 | Extract a qualified source sentence and a misleading stronger paraphrase. Preserve the exact span and reject unsupported strengthening; extraction failure does not reduce publisher reliability. |
| FACT05 | Compare repeated copies, uncertain origin matches and genuinely independent observations. Known derivatives cannot inflate corroboration; unknown dependence stays unknown; similarity is not a permanent transitive union. |
| FACT06 | Re-ingest a REZICS answer through another host or generated summary. Retained lineage identifies circular support; changed URL/provider does not create independent evidence. |
| FACT07 | Check a recomputable value and an institution-defined claim. A correct calculation can have unsuitable inputs; institutional authority is limited to the relevant field. No universal two-source rule. |
| FACT08 | Retrieve supporting text that concerns another entity, time or role. Matching words and plausible URLs are insufficient; preserve evidence relevance and unresolved identity. |
| FACT09 | Exercise support, refutation, conflict, insufficient evidence and non-verifiable claims. Missing data, explicit no-value, negative assertion and retrieval failure remain distinct. |
| FACT10 | Return model agreement/high self-confidence with no inspected evidence. No calibrated probability or automatic qualification is inferred; a human sign-off also needs its declared basis. |
| FACT11 | Change method/model/schema or send an out-of-stratum language/property. Old qualification does not transfer silently; record a new assessment and apply explicit abstention/escalation. |
| FACT12 | Native adoption races a source rebind or same-value human confirmation. The canonical writer rechecks predecessor/override/policy epochs; no duplicate effective field and no loss of independent support. Structural-field assessment uses an exact owner-adapted REV/property without a second writable assertion. |

## Lifecycle, authority and portability cases

| ID | Scenario and required result |
| --- | --- |
| FACT13 | Publisher reschedules May 1 to May 10; a later shop crawl still says May 1. Valid supersession updates only the matching planned release, preserving history and independent contexts. |
| FACT14 | Withdraw one source or an evaluator's assessment. Remove only its contribution; preserve other support, invalidate dependent current results and retain permitted history. |
| FACT15 | Repair an entity mapping after downstream human edits. Invalidate affected assessments; split/compensation retains ambiguous assignments instead of promising perfect automatic undo. |
| FACT16 | Change source/method/policy/authority while a worker or staged build is running. Old leases and stale predecessors cannot activate results. Duplicate delivery records one semantic effect. |
| FACT17 | Interrupt model execution, lose its response, exhaust budgets, cancel, or receive malformed structured output. Execution failure is separate from an epistemic verdict; retries cannot silently duplicate billed work. Cached assessment reuse is distinguished from a fresh commissioned run in receipts and quota accounting. |
| FACT18 | Insert adversarial instructions into evidence or return a tool request from the model. They cannot change method policy, grant tools, read another source or cause native writes. |
| FACT19 | Two independent issuers assess one exact claim differently. Preserve both and their evidence; a third party may dispute but cannot rewrite either issuer. Default acceptance has an explicit policy basis. |
| FACT20 | Verify signed-but-false, unsigned, unknown-signer and revoked-key records. Integrity/issuer outcomes remain separate from factual acceptance and native write authority. |
| FACT21 | Export permitted records and rebuild with an independent consumer using fixed recorded assessments/policy. Selections match; rerunning a stochastic model is evaluated separately as a new assessment. |
| FACT22 | Reorder/retry paged imports, interrupt at a partition boundary, then reconcile a missed retraction. Checksums/cursors detect gaps; no old record resurrects current withdrawn support. |
| FACT23 | Restrict or erase evidence after an answer, export or cache was built. Current disclosure fences bodies, snippets, IDs/digests, counts and stubs before paged repair; restore replays revocation/erasure before serving. Reuse/deduplication cannot cross incompatible processing, disclosure or retention domains. |
| FACT24 | Export with unavailable or restricted dependencies. Manifest reports permitted coverage/fidelity and cannot claim a completely rebuildable result or reveal hidden existence. |

## Query, quality and commercial cases

| ID | Scenario and required result |
| --- | --- |
| FACT25 | Combine semantic and supported quality predicates on a generation-bound query. Preserve explicit unknown states; reject unsupported operators and stale/mismatched cursors rather than dropping filters. |
| FACT26 | Exhaust a candidate/hydration budget with hidden or stale rows. Return permitted continuation/incomplete outcomes; counts/facets do not leak hidden data or mix generations. |
| FACT27 | Fail a replacement index build after a source correction. Previous generation stays installed, but the invalidation frontier prevents serving known-invalid answers as current. Frontier unavailability is explicit. |
| FACT28 | Serve historical answers after access changes. As-of-data never restores revoked access; policy/method versions and valid/observed/assessment times remain distinguishable. |
| FACT29 | Compare an easy high-precision subset with broad long-tail coverage. Report denominator, sampled strata, coverage, abstention and uncertainty; no per-claim probability from corpus accuracy. |
| FACT30 | Evaluate related copied sources and later time periods. Hold out origin groups/time; disclose imperfect labels and separate extraction, matching, retrieval and acceptance errors. |
| FACT31 | Saturate popular/paid verification requests. Reserved exploration and correction capacity remain available; report allocation/coverage effects and backpressure. |
| FACT32 | Change only funding metadata for fixed inputs, method and recorded result across paid, gifted, contributor and ordinary paths. Criteria/verdict do not change. Additional funded work can produce a new evidence/method-bound assessment; neither payment nor stochastic rerun differences justify a score adjustment. |
| FACT33 | Gift a higher benefit and purchase a lower plan for an eligible index/service. Preserve all Subscribe purchase invariants and independent grant expiry/revocation; no Realm is manufactured. |
| FACT34 | Restrict enhanced analysis to subscribers after a known correction. All permitted answer readers receive safe material correction/uncertainty status; private evidence stays protected. |
| FACT35 | A seller offers another issuer's evidence/index without resource approval. Reject the benefit mapping; purchasing an index grants neither arbitrary source access nor native adoption authority. |
| FACT36 | Read the same result through web/API/SDK/export/AI adapters. Preserve policy, exact basis, material uncertainty, generation and disclosure semantics. |

## Capacity and recovery qualification

Use the architecture's [workload envelope](../architecture/information-indexing-and-verification.md#workload-envelope),
the existing source/native envelopes and actual physical-family widths. Do not
double-count shared source records or assume one claim per catalog object.

| ID | Required workload and evidence |
| --- | --- |
| CAPFACT01 | Analyze each growing assessment, evidence, history, membership, dependency and receipt family at 500M and 3B rows; measure row/index widths, retained artifacts, WAL, replicas and recovery reserve. |
| CAPFACT02 | Measure selective/dense quality filters, mixed contexts, deep cursors and skewed origins using EXPLAIN and bounded hydration. Include underestimated postings, cross-index sorting, engine cancellation, shard/segment fan-out, unauthorized/stale candidate ratios, latency percentiles, throughput, CPU/RAM/network and explicit incomplete outcomes. |
| CAPFACT03 | Change one widely copied source, method or correspondence while reads and builds continue. Demonstrate bounded coalesced fan-out, immediate invalidation fencing and measured repair/catch-up latency. |
| CAPFACT04 | Saturate worker/provider/queue budgets with retries and bursts. Record runs/tokens/fetches, actual concurrency, queue age, per-operator fairness, correction/exploration allocation and cost per useful assessment. |
| CAPFACT05 | Interrupt bootstrap, incremental build, export/import and restore at checkpoints. Resume without duplicate effects, false complete manifests, lost corrections or disclosure before erasure/revocation replay. |
| CAPFACT06 | Compare ordinary and hot partitions at both planning scales. Record limiting resources and a concrete throttling/partition/shard/archival path; no whole-corpus model refresh or unbounded per-user materialization. |

## Evidence required before activation

Contract cases use small pinned, rights-compatible fixtures and controlled
provider/model responses for reproducible integrity checks. Such responses do not
measure real model quality. Native adoption requires real PostgreSQL/domain/API
flows, including concurrent rejected operations; portability requires a genuinely
independent reader of the exchange contract.

Model/method evaluation uses independently adjudicated samples with exact source
and valid-time cuts, origin-group/time holdouts, sampling scheme, label uncertainty,
model/configuration revisions and resource usage. Publish coverage/error/abstention
curves by stratum, false-merge rates, freshness/correction delay and costs. Select
numeric acceptance thresholds before evaluating the held-out sample; a successful
small benchmark does not qualify every language, domain or production load.

Record tested commit, input manifests/digests, data distributions, method/policy
versions, commands, runtime/settings, outcomes and remaining limits in this owner
when executed. Owning fixtures, runners and capacity-generator integration are
pending; no runtime verification command is claimed here. The program's phase
policy defers those checks and experiments until the applicable verification scope.

## Analytical performance review

September 15, 2026: the maintainer explicitly authorized this scoped mathematical
and time-complexity review. Python 3.14.7 standard-library arithmetic was executed
against the assumptions from design commit `9b653203a`; the architecture now distinguishes
retained revisions R from current targets C and average in-flight demand from
worker-slot sizing. The active IAM phase remains unchanged.

Recalculation confirmed every independent family width total, expanded row/metadata/
artifact total and changed-target run/token/fetch total in the owning workload
example. It also calculated residual-filter scans, all-pairs versus bounded matching,
bitmap memory, repair page count and profile-combination growth. The complexity
review is an argument about the specified access strategies, not executed query
plans or a formal proof of an implementation. No permission/state model, database,
model-quality evaluation or load benchmark was run; FACT/CAPFACT remain unqualified.

The follow-up also inspected the complete verification design and its direct
source, semantic-index, Subscribe/reply, Tag suggestion, Filter preparation,
catalog-manifest and ranking capacity contracts, plus the
current Search/worker source paths where a performance claim depended on behavior.
It was not a whole-repository implementation audit. Primary PostgreSQL 18,
PGroonga/Groonga and LOTUS/integration research support the
[selected remedies](../architecture/information-indexing-and-verification.md#selected-performance-remedies).

| Finding | Documentation correction / selected remedy |
| --- | --- |
| Current Search described estimated postings as an actual-work ceiling. | Distinguish plan estimates from actual posting/filter/sort work; require observed costs and qualified engine cancellation. No runtime bound is claimed fixed. |
| Tag suggestions reused the same estimate-to-bound inference; a proposed cache did not bound misses. | Apply the same engine execution accounting and finite cache-fill budgets. |
| Small candidate buffers did not account for database operators and concurrency. | Separate application buffers from bitmap/sort/hash/parallel-worker memory and spill costs. |
| AI review cost counted attempts without accounting for multiple calls. | Count total model calls per admitted execution, including retries, within the existing three-call ceiling. |
| Retained revisions and current targets shared a workload denominator. | Use R for retained storage and C for current-target work; price additional refresh/audit/intake separately. |
| A source no-scan statement also appeared to cover bootstrap/rebuild. | Restrict it to interactive lookups/polls; keep explicit bulk work proportional to covered data. |
| Filter preparation and manifest restoration used ambiguous O(1) claims. | Separate bounded compilation/head-row changes from logarithmic cache-miss lookups and linear member/data restoration work. |
| Small ranking batches/cleanup pages obscured total scheduled work. | Add dispatch and retirement-throughput lower bounds; do not copy full-snapshot refresh into every verification profile. |
| Query/engine scale limits needed a concrete strategy. | Select common profile orders, scoped text plans, blocking/cascades, partitioned serving indexes and changed-segment maintenance. |

The three related capacity tables below had 62 numeric result cells, all matching
their row-width arithmetic at the stated displayed precision. Their arithmetic
does not qualify the underlying width or workload assumptions. Additional calculated
examples cover source bootstrap, ranking build/retirement, review calls, shard
merge input and cascade sensitivity.

Reproduce the arithmetic from the repository root with Python's standard library:

```sh
python3 - <<'PY'
from fractions import Fraction as F
from math import ceil
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
import re

for n in (500_000_000, 3_000_000_000):
    # Storage evaluates R=n; daily work separately evaluates C=n.
    a, e, p = 2, 3, 2
    storage = n * (a*512 + a*e*256 + p*192)
    runs = F(n, 1000) * F(1, 10) * 2
    in_flight = runs * 30 / 86400
    print('population', n)
    print('family bytes', {w: n*w for w in (512, 256, 384, 192)})
    print('rows, metadata, provisioned, artifact bytes',
          n*(a+a*e+p), storage, storage*4, n*a*8192)
    print('daily changed-target runs, input/output tokens, fetches',
          runs, runs*2000, runs*500, runs*3)
    print('mean in-flight, rounded, slots at 70% utilization',
          in_flight, ceil(in_flight), ceil(in_flight/F(7, 10)))
    print('daily full-recheck runs/tokens', n*2, n*2*2500)
    print('all pairs, bounded pairs, ceil log2',
          n*(n-1)//2, n*50, (n-1).bit_length())
    print('one bitmap / 32 bitmaps bytes', (n+7)//8, 32*((n+7)//8))
    shards = ceil(F(n, 100_000_000))
    print('example shards / local top-50 merge rows', shards, shards*50)
    print('source core bytes / bootstrap days at 50 subjects/s',
          n*140*256, float(F(n, 50*86400)))
    print('ranking batches / ideal two-hour build process-equivalents',
          ceil(F(n,4096)), ceil(F(n,7200*4*4096)))
    print('ideal hourly-score-retirement process-equivalents',
          ceil(F(n,3600*4000)))
print('expected scans for 50 matches',
      {str(s): 50/s for s in (F(1,10), F(1,100), F(1,1000), F(1,1_000_000))})
print('expected matches within 5000 scans at 0.1%', 5000*F(1,1000))
print('repair pages', ceil(F(1_000_000, 256)))
print('20 binary filter combinations', 2**20)
print('review in-flight / daily calls for m=1.2 and m=3',
      [(5*m*8, 86400*5*m) for m in (F(6,5), F(3))])
q, hit, escalation = 100_000, F(4,5), F(1,10)
cost = q*F(1,1000) + q*(1-hit)*(F(1,50)+escalation) + 1000
print('cascade cost / all-deep cost / ratio', cost, q, cost/q)

checked = 0
for name, marker, widths, columns, implicit in (
    ('catalog-source-lifecycle.md', '| Family | Approx.', (1,), (2,3), None),
    ('subscriptions-capacity.md', '| Growing family | Heap/', (1,2), (3,4), None),
    ('semantic-interoperability-capacity.md', '| Growing family / each',
     (1,), (2,3), ('GB','TB')),
):
    doc = Path('docs/architecture', name).read_text()
    rows = doc.split(marker, 1)[1].splitlines()[2:]
    for row in rows:
        if not row.startswith('|'):
            break
        cells = [cell.strip() for cell in row.strip('|').split('|')]
        width = sum(Decimal(cells[i].replace(',', '')) for i in widths)
        for j, (population, col) in enumerate(zip((500_000_000,3_000_000_000), columns)):
            match = re.fullmatch(r'([0-9.]+)(?: (GB|TB))?', cells[col].replace(',', ''))
            stated = Decimal(match[1])
            unit = match[2] or implicit[j]
            actual = Decimal(population)*width/Decimal(10**(9 if unit=='GB' else 12))
            precision = Decimal(1).scaleb(stated.as_tuple().exponent)
            if actual.quantize(precision, rounding=ROUND_HALF_UP) != stated:
                raise ValueError((name, cells[0], stated, actual))
            checked += 1
print('related capacity result cells matched', checked)
PY
```

The source population, widths, selectivity and service times are assumptions,
not measurements. Arithmetic agreement does not validate their empirical values
or set a millisecond SLO. No provider price or total-platform cost is inferred.
