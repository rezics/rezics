# Wiki Content Ownership & Lock Mechanism Plan

**Status**: Draft plan, pre-proposal
**Date**: 2026-05-15
**Scope**: Disambiguate "personal-mode" content (creator-owned) from "wiki-mode" content (catalog, custodian-owned) across BOOK / ENTITY / GAME / MEDIA. Define the substrate for owner-driven field locks needed once collaborative editing (per [[history-infrastructure]]) lands.

## Status update — 2026-05-16

Implementation is **deferred until paired with [[history-infrastructure]]**. The lock substrate, custodian-user, and creation-mode convention only make sense once collaborative editing arrives — the convention's purpose is to disambiguate owner-vs-editor authority at the moment that distinction starts to matter. Shipping the convention now would create a forward-compatibility tax (modes recorded but never enforced) without the load-bearing UI surface that justifies the discipline.

`entity-slug-activation` (the first follow-on that would have consumed this plan) proceeds without modes: all v1 ENTITY units are creator-owned, matching how BOOK / GAME / MEDIA are owned today. When the convention does land, it will be **forward-only** (no backfill of v1 rows, per §5.2) and will ship together with its first enforced UI surface so the convention and the enforcement arrive in the same change.

---

## 1. Motivation

Two creation intents collapse onto a single `Unit.userId` column today:

1. **Personal** — "I'm publishing my own work / cataloging my own thing": *my novel*, *my game*, *my author entity*. Ownership SHOULD belong to the creator.
2. **Wiki** — "I'm contributing an entry about something that exists in the world": *1984 by Orwell*, *Haruki Murakami the author*, *Elden Ring the game*. Ownership SHOULD belong to a system custodian because the subject is not the creator's to own.

Today's implicit rule: whoever first inserts the row becomes `Unit.userId`. This silently confers ownership semantics (and once `history-infrastructure` ships, edit/lock authority) to a user who has no real claim on the content.

`history-infrastructure` (already drafted in `openspec/plans/history-infrastructure.md`) is the platform's path toward genuine collaborative editing. As soon as that lands:

- The current "only owner can edit" rule must relax to "owner + community, gated by policy".
- Owner identity stops being a synonym for editor identity. Lock semantics must replace the implicit gate.

This plan addresses both gaps in one design pass:

- **§3** — the creation-mode convention (active now, ships before history).
- **§4** — the lock substrate (designed now, ships with history).

---

## 2. Affected Unit Types

```
Wiki-eligible (creation mode applies):
  BOOK     — books in the catalog
  ENTITY   — authors, characters, publishers, voice actors, etc.
  GAME     — game catalog
  MEDIA    — film / TV / animation catalog

Personal-only (always creator-owned, no wiki mode):
  POST, IMAGE, VIDEO, QUOTE, LINK, CHAPTER, SHELF

Special (separate ownership semantics, out of scope here):
  USER, REALM, TAG, ZONE
```

A type is "wiki-eligible" when it represents a **real-world referent** whose existence is independent of the platform. Personal content represents the user's own expression and never gets a custodian.

---

## 3. Core Convention — Two Creation Modes

### 3.1 Mode Table

```
┌──────────────┬─────────────────┬───────────────────────────────┐
│ Mode         │ Unit.userId     │ UX trigger                    │
├──────────────┼─────────────────┼───────────────────────────────┤
│ personal     │ creator         │ "Publish your work"           │
│              │ (current user)  │ "Register as <author>"        │
│              │                 │ "/me/entities/new"            │
├──────────────┼─────────────────┼───────────────────────────────┤
│ wiki         │ custodian user  │ "Add to catalog"              │
│              │ (system / root) │ EntityPicker inline create    │
│              │                 │ NewBookPage cataloging mode   │
└──────────────┴─────────────────┴───────────────────────────────┘
```

### 3.2 Substrate (No Schema Change)

`Unit.userId` already carries the right shape. The convention is purely a **write-time rule** for which userId to assign:

- Personal mode: `Unit.userId = currentUser.unitId`
- Wiki mode: `Unit.userId = CUSTODIAN_USER.unitId` (see §3.3)

No new column, no migration of existing rows (§5.2).

### 3.3 Custodian User

A dedicated system user holds wiki ownership:

- **Lean: dedicated `system` user**, separate from `root` admin user.
- Reasoning: conflating "root admin" with "owner of every wiki entry" muddles audit trails. `root` should retain pure admin meaning. The system user has no auth credentials, never logs in, and exists only as the userId on wiki-owned rows.
- Seeded via `prisma/seed/` alongside root user.
- The exact name (`system`, `wiki`, `catalog`) is a §5.1 decision item.

### 3.4 Mode Selection per Surface

Each create surface decides its default mode based on intent:

```
Surface                                    Default mode
─────────────────────────────────────────  ────────────
NewBookPage (catalog flow)                 wiki
NewBookPage (publish-my-novel flow)        personal
EntityPicker spawn (inside Book/Game)      wiki        ← always
/me/entities/new                           personal    ← always
NewGamePage / NewMediaPage                 wiki
Author-onboarding "register as me"         personal
```

When both modes are plausible on the same surface, the UI exposes an explicit toggle. EntityPicker is the clearest "always wiki" case: spawning an entity inline always means "credit someone else".

---

## 4. Lock Mechanism (Deferred to History Era)

### 4.1 Why Lock Exists

[[history-infrastructure]] enables community editing. Once that ships, "Unit.userId == editor" is no longer true — anyone with permission can edit. The owner needs a way to protect identity-defining fields from drift.

Field-level lock answers: *"As the rightful owner, which fields am I keeping authoritative against community edits?"*

### 4.2 Granularity Choice

```
Coarse  (single flag)             Medium (per-field)         Fine (per-cell)
─────────────────────             ───────────────────        ───────────────
Unit.locked: Boolean              Unit.lockedFields: Json    Lock { unitId,
"no community edits"              ['title', 'cover', ...]      field, locale,
                                                               by, at }
Too blunt — kills wiki value      ↑ Recommended ↑              Overengineered
                                                               before evidence
```

**Recommendation**: **medium**, `Unit.lockedFields: String[]`. One column, contract-defined field-name vocabulary per unit type. Locks apply only to community editors — admins override with audit log entry.

### 4.3 Lockable Fields per Type (Draft Vocabulary)

```
BOOK    title · subtitle · cover · isbn · publisher · releaseDate · attribution
ENTITY  name (translations) · kind · avatar · attribution
GAME    title · cover · platforms · attribution
MEDIA   title · cover · runtime · attribution
```

Common pattern: **identity fields** (title, cover) + **attribution** (credits should never be silently rewritten). Free-form fields (summary, description, tags) generally stay unlockable — they're the wiki surface.

### 4.4 Edit Admission with Lock

Pseudocode for the future edit gate:

```
canEdit(user, unit, field):
  if user.unitId == unit.userId:        return true   # owner always edits
  if user.role == 'admin':              return true   # admin override (audited)
  if field in unit.lockedFields:        return false  # community blocked by lock
  if unit.type in wiki-eligible:        return true   # community edit on wiki content
  return false                                         # personal content stays private
```

### 4.5 Defer Substrate?

The lock column itself does not ship until `history-infrastructure` ships. Reasons:

- Without history, no community editor exists — nothing to block.
- Lockable field vocabulary depends on what fields History decides to version (snapshot vs diff per §2.3 of the history plan).
- Adding the column before semantics are tested invites churn.

This plan documents the design **so the eventual change has a target**, not so the substrate ships now.

---

## 5. Decisions

### 5.1 Custodian User Identity — Open

`system` vs `wiki` vs `catalog` vs reuse `root`. Lean: dedicated `system` user. Final decision belongs in the proposal.

### 5.2 Existing Row Backfill — Decided (No Backfill)

Convention is forward-only. Past wiki-shaped rows that landed under a creator's userId remain as-is. Risk: dev/demo seeded data retains "ownership" by the seeding user — acceptable since dev data isn't anchor data. Production has no anchor data at this development stage.

### 5.3 EntityPicker Inline Spawn Mode — Decided (Always Wiki)

When EntityPicker (inside NewBookPage / NewGamePage) creates an entity inline, the new entity is wiki mode unconditionally. Rationale: the user is creating an entity *to credit someone else*. Self-claim flows live elsewhere (`/me/entities/new`).

### 5.4 Lock Substrate Timing — Decided (Defer to History Change)

No `lockedFields` column in this plan's proposal sequence. Substrate ships inside the history change (`content-history` or equivalent) where it has a working edit gate to attach to.

### 5.5 Lock Override by Owner Transfer — Deferred

If a wiki entity later claims a real human owner (e.g., admin promotes via `entity-slug-activation`), ownership transfers from `system` to the claimed user. Lock state at transfer time: cleared? preserved? — deferred until claim flow is designed.

### 5.6 Mode Toggle UX — Open

On NewBookPage, expose explicit "personal / catalog" toggle, or route-based default (`/book/new/personal` vs `/book/new/catalog`)? Lean: route-based default + visible mode indicator + "switch mode" link. Avoids ambiguous radio buttons on a long form. Final UX decision belongs in the proposal.

### 5.7 System User Avatar / Display — Decided (Hidden)

The system user is never rendered as a user. Wiki-owned content shows no owner card; the byline shows "Community catalog" or an equivalent neutral label. The system user's existence is implementation detail.

---

## 6. Cross-cutting Considerations

### 6.1 Permission Spec Alignment

`identity-claim-consistency` already states that authorization compares actor `userId` against explicit owner identifiers. Wiki entries owned by the system user simply fail the "is this yours?" check for normal users — no special case needed. Lock layer (when it lands) augments this with field-level admission.

### 6.2 History Plan Dependency

[[history-infrastructure]] section 2.5 ("bot is user") is consistent with this plan: the system user is a normal `User` row, subject to the same audit-log semantics. When wiki edits flow through the history layer, the audit trail correctly attributes the editor (not the custodian) as the change actor.

### 6.3 Identity Edge — User-as-ENTITY

A user who registers as an author and creates an ENTITY in personal mode owns that ENTITY. If admin later assigns a slug via `entity-slug-activation`, ownership stays with the user.

If a wiki ENTITY already exists for the same person (community-added "Haruki Murakami") and Haruki later joins the platform, **merging two entities** is a separate claim flow — out of scope here. The substrate supports it: admin re-points `Unit.userId` from `system` to the claimed user and clears any locks.

### 6.4 Attribution Stability

Wiki-owned entities are heavily referenced by `Attribution(unitId, entityId, role)`. Ownership transfer (system → user via claim) does not change `entityId` — the attribution graph is stable. No FK rewrites needed.

### 6.5 Search Indexing

Meilisearch documents already index `userId`. Wiki content's userId becomes the system user's unitId — a constant. This may visibly differ from creator-led content during search-result rendering; the renderer must treat system userId as "no human owner".

---

## 7. Proposal Sequence

Three OpenSpec changes emerge from this plan:

1. **`content-creation-mode`** — the core convention, ships now
   Specs touched: NEW `wiki-content-ownership`; MODIFIED `book-creation`, `entity-unit-type`, any game/media creation specs
   - Seeds the `system` user in `prisma/seed/`
   - Adds mode chooser (or route-based default) to each affected create surface
   - Sets `Unit.userId = system.unitId` on wiki-mode writes
   - Documents the field-lock substrate as a forward design only

2. **`entity-slug-activation`** — already planned, hard-depends on (1)
   See `openspec/changes/entity-slug-activation/` for full scope. With (1) in place, EntityPicker's wiki-mode spawn has a defined convention.

3. **`content-history-and-lock`** — future, no schedule
   Aligns with [[history-infrastructure]]. Adds `Unit.lockedFields` column, implements edit admission per §4.4, builds owner-side lock UI. Triggered when product wants real community editing.

### 7.1 Execution Order

```
   content-creation-mode  →  entity-slug-activation  →  content-history-and-lock
   (this plan, ships now)    (already planned)            (paired with history plan)
```

---

## 8. Open Questions

- §5.1 custodian user name — `system` vs alternative
- §5.5 transfer of lock state when wiki entity gets claimed
- §5.6 UX of mode choice on NewBookPage — explicit toggle vs route-based default
- Whether the system user should also own seeded TAG / REALM rows for consistency — likely no (TAG/REALM have their own ownership semantics) but worth confirming during the proposal write-up
