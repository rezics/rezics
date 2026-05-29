---
name: rezics-propose
description: Propose a code-first plan — a single markdown file with context, durable constraints/decisions, and a task checklist. No spec files, no OpenSpec. Use when the user wants to turn an idea into actionable, implementable work.
metadata:
  version: 0.1.0
  license: AGPL-3.0-only
---

Produce one executable plan at `plan/proposal/<slug>.md`. **No spec files. No
OpenSpec. No validation CLI.** A plan is a disposable scaffold: when its work
lands, its durable content has migrated into code/comments/tests and the plan can
be deleted (a human deletes it; you do not, unless told).

This project is **code-first**. A plan's job is to carry only what code cannot yet
carry: the work to do, and the constraints/decisions the implementer must honor —
the same constraints that will become comments and tests at apply time.

---

## Steps

1. **Get the request.** If unclear, use **AskUserQuestion** to ask what they want
   to build or fix. Derive a kebab-case slug (e.g. "add poll voting" → `add-poll-voting`).
   Do not proceed without understanding the goal.

2. **Ground in the codebase.** Read the relevant domains before writing. Identify
   the files that will change and the existing patterns to match
   (`{domain}.api.ts/.service.ts/.mapper.ts/.types.ts`; contracts in
   `@rezics/contract`; frontend API in `@rezics/api`). A plan written without
   reading the code is a guess.

3. **Write `plan/proposal/<slug>.md`** using the structure below. If a file with
   that slug exists, ask whether to continue it or pick a new slug.

4. **Summarize**: slug, location, and the task count, then "ready to implement —
   ask me to start, or work through the task list." Implementation is ordinary
   coding against the tasks; there is no apply CLI and no separate apply skill.

## Plan file structure

```markdown
---
title: <Human title>
status: active        # draft while shaping; active once ready to implement
created: <YYYY-MM-DD>
completed:
supersededBy:
tags: [<domain>, ...]
---

## Why
One or two paragraphs: the problem and the intended outcome. Not a spec — just
enough for an implementer (or future you) to know what this is for.

## Durable constraints & decisions
The non-obvious rules the implementation must honor — invariants, deliberate
non-restrictions, known tradeoffs, "do X not Y" boundaries. **These are the
items that must become code comments and tests at apply time.** Mark each with
its target home:
- `(comment)` an invariant/why that a type can't express
- `(test)` a behavior to lock with a test
- `(type)` a shape/value-set that the schema/types will carry — no prose needed long-term

## Tasks
- [ ] 1.1 <concrete, file-level step>
- [ ] 1.2 ...
Group with `## N. <phase>` headings when the work has phases.

## Out of scope
What this plan deliberately does not do.
```

## At apply time (remind the implementer)

When the tasks are done, route every durable item to its home and let the plan
become disposable:

| Item | Home |
|---|---|
| Shape, legal values, types, indexes | Types / Valibot / Prisma |
| Behavior under conditions | A test |
| Irreducible invariant / why / deliberate non-restriction / known staleness | A concise comment at the owning code |
| History, migration steps, rename maps | The git commit message |

Then set `status: done` (a human deletes the file later).

## Guardrails

- **Never create spec files or touch `openspec/`.** This workflow has no specs.
- **Read before writing** — ground the plan in real files and patterns.
- Keep the plan tight: tasks must be concrete and file-level; constraints must be
  the non-obvious ones, not a restatement of the types.
- Prefer reasonable decisions to keep momentum; only ask the user when a choice
  genuinely changes the work.
- **Do not implement** from this skill — proposing produces the plan; implementing
  is a separate step.
