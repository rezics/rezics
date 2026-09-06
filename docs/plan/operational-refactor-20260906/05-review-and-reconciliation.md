# P05 — Change proposals, identity resolution and AI-assisted review

Status: planned, not implemented. Date: 2026-09-06. Parent: [program and gates](README.md).

## Outcome and owners

Make automated sources and user contributions converge through explainable, replayable decisions. Supports U09 and the reliability of every catalog product line.
Reuse `units/merge`, immutable governance/history concepts, `services/authorization` and source revision references. Current content-governance cases handle publication enforcement; catalog factual proposals have their own typed lifecycle while sharing decision/audit infrastructure.

## Selected workflow

Observation or user submission → deterministic validation → indexed identity candidates → bounded change proposal → review tasks → policy decision → canonical owner command → revision/outbox → projection.

- Classify tasks into identity matching, factual reconciliation and content/safety review; they return independent outcomes.
- Persist base canonical revision, source observations, binding/policy/definition revisions, changed fields/relations, evidence, model/prompt/evaluator versions and allowed actions.
- Statuses distinguish draft, pending, needs-evidence, approved, rejected, superseded, applying, applied and failed. An approved proposal is not applied until canonical commit succeeds.
- The model has no direct database or unrestricted tool-write capability. Its structured proposal is untrusted until schema, permissions, scope, source-use policy and domain invariants pass.
- External source text is data, including embedded instructions. Evidence retrieval is allowlisted/budgeted; output must cite the selected evidence records, not invent URLs.
- A decision only applies to its fingerprint. Recheck current identity, source/binding revision, human protection and grant state inside the applying transaction.
- Accepting only part of a proposed patch creates a newly fingerprinted subset proposal/decision with fresh precondition checks; a whole-patch approval cannot silently authorize a changed subset.
- A source-remapping correction is separate from permanent Unit identity merge. Tentative matches can be reversed without rewriting user histories.
- Shared provenance is not independent corroboration. Prefer scope-specific trustworthy evidence; retain disagreement and explicit uncertainty.
- Low-risk updates may auto-apply only within an evaluated action allowlist. Identity merges, authority claims, human-edit overrides and mass withdrawals require human decision in the initial operational policy.
- User-owned private journal/collection edits do not wait for catalog-factual AI review. Public prose and public catalog changes follow their relevant governance paths.

## Identity resolution

Use exact namespace IDs and verified identifier claims first, then normalized multilingual names plus creator, date, edition, platform and relation evidence. A title alone never merges records. Retrieve bounded candidates through selective indexes; score only those candidates. Test candidate recall separately from pairwise precision.

Keep a permanent rejected-pair/binding decision keyed by evidence version to avoid repeatedly asking the same question. Reopen only on meaningful new evidence or a policy change. Uncertain cases can remain separate, usable records; do not force invented certainty.

## Implementation slices

1. Version review/automation policies and typed result schemas. Extend service-actor attribution through P02 without forging human reviewer identities.
2. Implement proposal creation/diff/fingerprint/state transitions, deterministic no-op/rejection paths and application commands.
3. Build indexed candidate retrieval and explicit exact/same-work/different-edition/uncertain outcomes; wire approved permanent merges to the existing convergent operation.
4. Add model adapter, evidence budget, eligibility-aware payload redaction and private/self-hosted processing route where external use is not permitted.
5. Add console triage by risk/age/source, side-by-side evidence, split acceptance, protected edits, reasoned rejection, source rebinding, retry and appeal.
6. Shadow review against a frozen adjudicated corpus, then limited automatic adoption; retain a kill switch by source, model version and action family.
7. Replace the fixed four-reviewer requirement with a versioned policy requiring two independent reviewers for irreversible/high-impact identity merges and no proposer self-approval. Reversible source matching and ordinary low-risk edits have their own narrower policy. Insufficient merge-review staffing leaves records separate and usable; it does not block source correspondence or the product. No synthetic AI quorum or routine privileged self-approval bypass.

## Evaluation and operational gates

- Stratify fixtures by source/domain/language, popular/rare names, same-title editions, remakes, transliterations, officialness disputes, partial dates and malicious source text.
- Adjudicate labels with evidence; keep training/tuning and holdout sets separate and versioned.
- Track candidate recall, false merge rate, action precision, missed conflicts, abstention, reviewer reversal, cost and latency per action family.
- Initial auto-adoption gate: zero high-impact violations; for each enabled low-risk action family a one-sided 95% confidence bound on error below 0.1%, measured on representative held-out decisions, with no silent pooling across failed language/source strata. Roughly 3,000 zero-error independent cases only support an approximate aggregate 0.1% upper bound; correlated/underrepresented strata remain reviewed. Insufficient samples mean shadow/reviewed mode, not a guessed confidence percentage.
- Treat the threshold as a selected release policy, not proof that AI facts are objectively correct. Production sampling and drift checks continue; failures disable the affected allowlist.
- Store durable reviewer action separately from a model recommendation and from provider execution status.
- Unit merge acceptance remains irreversible under the current identity contract; prefer reversible source bindings until equivalence is established. Audit and compensation preserve history rather than promising a nonexistent undo.
- Human queue target is oldest actionable case under two working days; exceedance reduces new automatic proposal admission or narrows source scope. No endless unbounded backlog.

## Capacity and tests

Let daily changed source records be C, semantic-change fraction s and mean coalescing factor g: proposals ≈ Cs/g; model calls ≈ proposals × a plus controlled retries; human cases ≈ proposals × h, where h includes direct-human and post-AI referrals as a fraction of all proposals. Record input/output tokens and cache reuse rather than multiplying all source objects by a model call. Price is a deployment input. Redaction or a private model does not by itself establish processing rights; P04 eligibility applies to the actual mode and material.

Test duplicate and out-of-order events, expired leases, stale approvals, operator revocation, model timeout, schema-invalid output, injection strings, conflicting evidence and rejected-pair reopening. Add DB concurrency and rollback tests around apply/merge. P10 covers bounded jobs, 500M/3B proposal/evidence histories, retention and partition routing. Private prompts/audit access follow evidence rights and privacy policy.
