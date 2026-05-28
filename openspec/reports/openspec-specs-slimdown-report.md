# OpenSpec Specs Slimdown Report

**Status**: Exploratory report
**Date**: 2026-05-28
**Scope**: `openspec/specs/` — current 317 capability directories
**Report type**: Inventory audit + slimdown recommendation. Not an OpenSpec change proposal.

---

## 1. Executive Summary

`openspec/specs/` currently holds **317 capability directories**, **2,240 normative
requirements**, and **~39,551 lines** of spec text. The catalog is hard to
navigate and several capabilities have drifted from the OpenSpec format. The
clutter comes from three sources, in roughly decreasing severity:

1. **Un-normalized change-archive deltas.** 124 specs still carry
   `## ADDED Requirements` / `## MODIFIED Requirements` / `## REMOVED
   Requirements` headings. These markers are change-proposal vocabulary and
   should be flattened to `## Requirements` when the change is archived. Every
   one of these 124 specs also lacks the `# <name> Specification` heading and
   the `## Purpose` section that OpenSpec specs expect. The 32 additional
   specs that miss heading/purpose but have no delta markers are in the same
   family (archive merges that started from a blank file).
2. **Retired / shadow specs that should be deleted.** At least two specs
   self-identify as retired (`auth-organization`, `exchange-auto-provision`),
   and several pairs of capabilities appear to be naming-generation duplicates
   (e.g. `jwt-service-admin-api` vs `auth-jwt-service-admin-api`,
   `attribution` vs `unified-attribution`).
3. **Over-decomposed clusters.** Several domains are sliced into 7–19
   capabilities where 2–4 would be more honest about the architectural
   boundary. The biggest examples: 8 `reaction-*` specs for one service, 19
   `realm-*` specs for one product surface, 13 `editor-*` specs for one
   composable editor, 14 `content-*` specs.

A staged cleanup — delete obvious zombies, normalize delta markers in place,
then merge confirmed duplicates, and only then attempt larger cluster merges —
can plausibly take the spec catalog from 317 → ~180 capabilities with low
behavioral risk, because most of the work is editorial.

---

## 2. Catalog Inventory

| Metric | Value |
|---|---|
| Capability directories | 317 |
| Total lines in `spec.md` files | 39,551 |
| `### Requirement:` headings | 2,240 |
| Largest spec (`type-extension-book`) | 628 lines |
| Smallest spec (`auth-organization`) | 15 lines |
| Specs missing `# <name> Specification` heading | 165 |
| Specs missing `## Purpose` section | 156 |
| Specs with raw `## ADDED/MODIFIED/REMOVED Requirements` deltas | 124 |
| Self-declared retired specs | 2 |
| Top-level prefixes with ≥ 7 specs | `realm` (19), `content` (14), `editor` (13), `unit` (12), `shelf` (11), `admin` (10), `profile` (9), `reaction` (8), `entity` (8), `auth` (8), `type` (7), `seed` (7), `folio` (7), `settings` (7) |

---

## 3. Findings

### 3.1 Change-archive deltas were never normalized (124 specs)

OpenSpec change proposals are written in delta form
(`## ADDED Requirements`, `## MODIFIED Requirements`). When the change is
archived, the spec author is expected to fold those deltas into the
canonical spec under a plain `## Requirements` heading and add `## Purpose`
text. 124 specs in `openspec/specs/` skipped that step; their files still
begin with delta markers and contain no purpose statement at all.

Concrete shape of the problem (sampled from `jwt-service-admin-api/spec.md`):

```
## ADDED Requirements

### Requirement: List all JWT service records

The server SHALL expose `GET /admin/jwt-services` ...
```

Compared to the correctly normalized neighbor
`auth-jwt-service-admin-api/spec.md`:

```
# auth-jwt-service-admin-api Specification

## Purpose

Defines owner-only auth-service APIs for listing, reading, creating, ...

## Requirements

### Requirement: ...
```

Implications:

- `openspec list` / spec tooling cannot reliably identify spec ownership when
  the title is missing.
- The reader has to scroll the entire delta block to guess what the capability
  is for, because there is no Purpose paragraph at the top.
- The presence of delta markers wrongly suggests an active change proposal
  rather than archived behavior.

This is the single biggest source of "the specs feel cluttered" — the files
read like work-in-progress notes, not stable specifications.

### 3.2 Self-declared retired specs (2 confirmed, more likely)

The following specs explicitly mark themselves as retired in their Purpose
text. They contribute zero normative behavior to the project and can be
deleted outright:

| Spec | Self-declared status |
|---|---|
| `auth-organization` | "This capability has been retired. Auth organization is no longer a Rezics product/account management surface ..." |
| `exchange-auto-provision` | "This capability has been retired. The `POST /session/exchange` endpoint and its JWT-in-header auto-provisioning path were deleted ..." |

A broader phrase scan (`retired`, `no longer`, `deprecated`, `has been
removed`) hits 30+ additional specs in their Purpose paragraphs, but most of
those use those words in context (e.g. "retains backward-compatible
behavior") rather than as a retirement declaration. Each one needs a manual
read; see §5 task list.

### 3.3 Suspected duplicates (naming-generation pairs)

Several capabilities appear to be the same domain re-specced under a newer
naming convention while the old file was never removed:

| Likely canonical (newer) | Likely retired (older) | Evidence |
|---|---|---|
| `auth-jwt-service-admin-api` (101 lines, full title + Purpose) | `jwt-service-admin-api` (89 lines, raw `## ADDED Requirements`) | Same domain (owner-only JWT service CRUD); newer file has full structure. |
| `admin-auth-jwt-service-ui` (68 lines, full title + Purpose) | `jwt-service-admin-ui` (56 lines, raw `## ADDED Requirements`) | Same domain (admin UI for JWT services). |
| `unified-attribution` (125 lines, raw `## ADDED Requirements`) | `attribution` (198 lines, raw `## Requirements`, no title/purpose) | Both describe the attribution junction table; need human read to decide merge direction. |

The `jwt-service-admin-{api,ui}` pair is the clearest case: same scope, but
the newer file has the canonical structure. The older one is a leftover
archive-delta file and should be deleted after confirming the requirements
made it across.

### 3.4 Over-decomposed clusters

Several domains are split too finely. Splitting helps when the slices
correspond to real architectural seams; here many slices correspond instead
to **the change proposal that introduced them** — each proposal added a new
spec rather than appending to an existing one.

The clearest candidates for consolidation:

| Cluster | Current count | Lines | Suggested target | Rationale |
|---|---|---|---|---|
| `reaction-*` | 8 | 652 | 3–4 (`reaction-api`, `reaction-hydration`, `reaction-history`, `reaction-notification`) | All 8 belong to a single reaction service. `reaction-auth`, `reaction-crud`, `reaction-internal-api`, `reaction-summary`, `reaction-user-state` are aspects of one HTTP API. |
| `editor-*` | 13 | 968 | 3–4 (`editor-core`, `editor-plugins`, `editor-toolbar`, `editor-image`) | Plugins (`editor-emoji`, `editor-mention`, `editor-markdown`, `editor-json`, `editor-markdown-preview`, `editor-scroll-sync`, `editor-cosmos-coverage`) are all variations on the same plugin contract. |
| `folio-*` | 7 | 543 | 2 (`folio-core`, `folio-plugins`) | Same pattern: 4 of 7 specs are reader plugins or gesture/pagination details of one reader. |
| `realm-tag*` | 5 | ~900 | 2 (`realm-tag-unit`, `realm-tag-governance`) | `realm-tag-context`, `realm-tag-interpretation-context`, `realm-tag-vote`, `realm-taxonomy-seed-support` describe related slices of the tag-on-realm story. |
| `shelf-*` | 11 | 2048 | 5–6 | `shelf-batch-hydration`, `shelf-items-batch-mutation`, `shelf-items-editor`, `shelf-item-kind`, `shelf-item-unit-junction`, `shelf-structure` are all editor/item-model concerns of one shelf product. |
| `profile-*-tab` | 5 (`profile-content/followers/reactions/realms/shelves-tab`) | ~250 | 1 (`profile-tabs`) | Each tab spec is small; one combined spec per tab kind would still fit. |
| `seed-*` | 7 | 751 | 3 (`seed-engine`, `seed-presets`, `seed-distribution`) | Distinguishing `seed-plan-modes` from `seed-preset-library` is finer than the actual code structure. |
| `default-realm-*` | 3 | ~200 | 1 (`default-realm`) | Three sibling specs (`-auto-join`, `-contract`, `-infra-bootstrap`) covering one bootstrap concept. |

Larger clusters (`realm-*` 19, `content-*` 14, `unit-*` 12, `admin-*` 10) are
real architectural surfaces and probably do warrant multiple capabilities,
but each cluster still contains 2–4 specs that could be folded. See §5.

### 3.5 Specs that lack any structural header (32 specs)

A second class of structurally broken specs starts directly with
`## Requirements` (no `#` title, no `## Purpose`). These are mostly small,
single-concern files (e.g. `cleanup` 22 lines, `attribution` first half).
They need the canonical wrapper added; their content itself is fine.

Representative examples: `attribution`, `cleanup`, `email-templates`,
`engagement-reaction-bar`, `reaction-history`, `reaction-hydration`,
`storybook-coverage`, `unit-slug`, `unit-picker`, `slug-validation`.

### 3.6 The OpenSpec config rules versus current state

`openspec/config.yaml` declares:

> specs:
>   - Write requirement statements in normative form (SHALL/SHOULD where applicable).
>   - Include at least one acceptance scenario per requirement.
>   - Separate user-visible behavior from implementation notes.

The 124 delta-marker specs and 32 header-less specs are not violating the
normative-form rule — they violate a different implicit rule: that a spec
should be readable as a standalone capability description, not as the diff
that produced it. This rule should be made explicit in `config.yaml` as part
of the cleanup, so that future archive merges normalize the file.

---

## 4. Recommended Slimdown Strategy

A four-phase approach. Each phase is independent and can stop at any point.

### Phase A — Delete confirmed zombies (low risk, ~2 hours)

Delete the 2 self-declared retired specs. Sweep the 30+ phrase-match
candidates by hand and delete any that turn out to be retired. No spec
content moves; only directory removal.

Expected reduction: 5–15 capabilities.

### Phase B — Normalize delta-marker specs in place (medium effort, low risk, ~1–2 days)

For each of the 124 specs in §3.1:

1. Add a `# <name> Specification` heading at the top.
2. Add a `## Purpose` paragraph (write fresh from the requirements present).
3. Replace `## ADDED Requirements` with `## Requirements`.
4. For `## MODIFIED Requirements` / `## REMOVED Requirements`, fold the
   delta into the existing requirement text and drop the delta header.

No requirement text changes meaning. Cluster equivalent rewrites by
prefix to keep diffs reviewable.

Expected reduction: small line-count gain (~5–10%). Big readability gain.

### Phase C — Merge confirmed duplicates (small but careful, ~half day)

Resolve the three confirmed pairs in §3.3:

- Delete `jwt-service-admin-api` (canonical: `auth-jwt-service-admin-api`).
- Delete `jwt-service-admin-ui` (canonical: `admin-auth-jwt-service-ui`).
- Merge `attribution` and `unified-attribution` (decide direction by content).

Verify each requirement is preserved in the survivor before deleting.

Expected reduction: ~3–5 capabilities.

### Phase D — Consolidate over-decomposed clusters (largest effort, design judgment)

Tackle one cluster at a time, in the order from §3.4. For each cluster,
write a short merge plan (which files collapse into which), reorganize the
requirements, and then delete the source files.

Expected reduction: ~80–110 capabilities (from a ~140-spec footprint across
these clusters down to ~30–40).

### Updated `openspec/config.yaml` rule (any phase)

Add to the `rules.specs` block:

> - Spec files SHALL start with `# <name> Specification` and contain a
>   `## Purpose` section before `## Requirements`.
> - Spec files SHALL NOT contain `## ADDED Requirements`,
>   `## MODIFIED Requirements`, or `## REMOVED Requirements` — those are
>   change-proposal vocabulary and must be flattened during archive.

This is a one-line policy change that prevents the §3.1 problem from
recurring.

---

## 5. Expected End State

| Phase | Capabilities after | Notes |
|---|---|---|
| Today | 317 | Baseline. |
| After A | ~305 | Zombies gone. |
| After B | ~305 | Same count, every spec well-formed. |
| After C | ~300 | Naming-generation duplicates gone. |
| After D | ~180–200 | Cluster consolidation complete. |

The task companion file (`openspec-specs-slimdown-tasks.md`) lists the
concrete work items in execution order.

---

## 6. Risks & Caveats

- **Risk of dropping a requirement during Phase C/D merges.** Mitigation: for
  every spec deletion, diff its `### Requirement:` list against the
  survivor's and check each one survives. A simple `grep "^### Requirement:"`
  before/after each merge is sufficient.
- **Risk of breaking external references.** Some OpenSpec change proposals
  reference capability names. After Phase C/D, run a grep across
  `openspec/changes/` and `openspec/abandoned/` for the deleted names and
  decide whether to update or leave the historical reference intact (these
  are archive directories, so stale names are acceptable).
- **Phase D is judgment-heavy.** The merge boundaries proposed in §3.4 are
  starting points. Each cluster merge should be reviewed by someone with
  context for that domain before execution.
- **This report is a snapshot.** New archive merges between today and
  whenever the cleanup runs may add more delta-marker specs; rerun the §3.1
  scan before starting Phase B.

---

## 7. Methodology Notes

All counts were produced by shell scans against `openspec/specs/*/spec.md`
on 2026-05-28:

- Capability count: `find openspec/specs -maxdepth 1 -mindepth 1 -type d | wc -l`
- Requirement count: `grep -h "^### Requirement:" openspec/specs/*/spec.md | wc -l`
- Delta-marker specs: `grep -l "^## ADDED Requirements\|^## MODIFIED Requirements\|^## REMOVED Requirements"`
- Missing title: `grep -L "^# .*Specification"`
- Missing Purpose: `grep -L "^## Purpose"`
- Cluster sizing: prefix counts via `ls openspec/specs/ | awk -F'-' '{print $1}' | sort | uniq -c`
