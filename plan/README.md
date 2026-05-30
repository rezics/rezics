# plan/

Lightweight, code-first planning workspace. We do **not** maintain a parallel
spec corpus. A plan is a disposable scaffold — once its work lands, its durable
content has migrated into code, comments, and tests, and the plan file can be
deleted (git keeps the history).

> Authoritative behavior lives in **code**: types/schemas express shape, tests
> express behavior, comments express the irreducible *why* and the invariants a
> type cannot. Plans only hold work-in-flight.

## Folders (by document type)

| Folder | Holds |
|---|---|
| `proposal/` | Executable plans: context + durable constraints/decisions + a task checklist. |
| `exploration/` | Thinking-in-progress, not yet ready to become a proposal. |
| `report/` | Findings/analysis worth re-reading later (investigations, risk write-ups). |
| `prompt/` | Reusable prompts. |
| `graveyard/` | Abandoned proposals/explorations, kept for human browsing. |

Folders are **document type**. Lifecycle is the front-matter `status` — files do
not move between type folders as they progress; only `status` changes. The one
exception is `graveyard/`: when something is abandoned, set `status: abandoned`
**and** move the file there (a physical place is easier to browse than a search).

## Front-matter

Every file under `plan/` carries:

```yaml
---
title: Post state schema
status: draft        # draft | active | done | abandoned | superseded
created: 2026-05-29
completed:           # date when status -> done
supersededBy:        # [[other-slug]], optional
tags: [post, state]
---
```

`status` is the source of truth for lifecycle and the primary searchable field.
A completed proposal is set to `status: done`; **deletion is a human action**
(do not auto-delete unless explicitly told).

Link related files with `[[slug]]`.

## Tools

- `/rezics-explore` — thinking partner; investigate and clarify, never implement.
  Captures to `plan/exploration/`.
- `/rezics-propose` — produce an executable plan in `plan/proposal/`. No spec
  files.

## Migrating constraints back to code

When a proposal is applied, route each durable item to its natural home:

| Spec/plan content | Home |
|---|---|
| Shape, legal values, types, indexes | Types / Valibot / Prisma — drop the prose |
| Behavior under conditions (GIVEN/WHEN/THEN) | A test |
| Irreducible invariant or *why* (incl. deliberate non-restrictions, known staleness) | A concise comment at the owning code |
| History, migration steps, rename maps | The git commit message — drop after landing |
