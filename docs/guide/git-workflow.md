# Git Workflow

Rezics keeps a compact `main` history and preserves task-branch development
history under `archive/*`.

## Mainline

`main` is the only integration baseline for current work. Feature, fix, and
refactor branches start from `main`, and completed work enters `main` as one
coherent commit unless a maintainer explicitly chooses a different merge
strategy.

`main` keeps product-level history: one completed feature, fix, refactor, or
maintenance change per commit. `archive/*` keeps development-level history: the
smaller commits, iterations, and review fixes that produced that result.

## Branch Roles

- `main` - current integration branch and source of truth.
- `release/*` - release freeze, release candidates, and patch lines.
- `stable/*` - long-lived maintenance lines for old versions only.
- `<owner>/<topic>` - personal or agent-owned work lines. The owner must be
  clear, for example `edge/crawler-preview-routing` or
  `codex/share-reference-counts`.
- `feat/<topic>` / `fix/<topic>` / `refactor/<topic>` - shared task branches
  intended to merge into `main`. Keep their number low and status clear.
- `spike/<topic>` - exploration or experiments with no promise of integration.
- `archive/<date>-<type>-<topic>` - historical snapshots no longer used for
  daily development. Use `YYMMDD-type-topic`, for example
  `archive/260606-feat-crawler-preview-routing`.
- `backup/*` - emergency insurance only, not a normal workflow.

## Feature Lifecycle

Create task branches from the current mainline:

```bash
git switch main
git pull --ff-only
git switch -c feat/<topic>
```

Keep feature history local to the task branch while developing. Before
integration, rebase onto the current mainline unless the maintainer asks for a
merge-based update:

```bash
git fetch origin
git rebase origin/main
```

When the feature is complete:

1. Record the feature base SHA and final feature tip SHA.
2. Create the archive branch at the feature tip and push it.
3. Squash the feature into one commit on `main`.
4. Include archive metadata in the squash commit trailers.
5. Delete the active `feat/*`, `fix/*`, or `refactor/*` branch after the archive
   branch exists remotely.

An archive ref may be created by renaming a local branch or by pushing the same
tip to a new remote ref. Remote Git only needs the final archive ref to point at
the preserved history; it does not preserve a portable branch-rename event.

## Squash Commit Messages

Use `.agents/skills/git-mainline-squash` when generating a mainline squash
message. The message has three parts:

```text
<type>(<optional scope>): <subject>

<body>

Archive-ref: archive/YYMMDD-type-topic
Archive-tip: <feature-tip-sha>
Feature-base: <feature-base-sha>
Original-branch: <original-branch>
Pull-request: #123
```

The subject is the Conventional Commit first line. The body is the GitHub squash
UI's commit description: one concise integration summary, with optional bullets
for major surfaces such as contract, server, app, migrations, tests, or tooling.
Do not put routine process work in the body.

Archive trailers are custom Git trailers. Use full SHAs for final metadata when
available. Omit `Pull-request` only when there is no PR.

Example:

```text
feat(crawler): add preview routing

Route crawler preview units through the shared app and server surfaces so
catalog preview flows resolve consistently.

- Adds preview route contract and server handling
- Wires frontend access through the shared API layer
- Covers routing behavior with focused tests

Archive-ref: archive/260606-feat-crawler-preview-routing
Archive-tip: <feature-tip-sha>
Feature-base: <feature-base-sha>
Original-branch: feat/crawler-preview-routing
Pull-request: #123
```

## Mainline Cutovers

Repository baseline cutovers use `archive/<date>-mainline-<topic>` and
mainline-reset trailers instead of feature trailers. The 2026-06-06 `dev` to
`main` cutover archive is:

```text
archive/260606-mainline-dev-before-main
```

The main snapshot commit should use:

```text
chore: establish mainline snapshot

Create the new main integration baseline from the current repository state.

Archive-ref: archive/260606-mainline-dev-before-main
Archive-tip: <archived-dev-tip-sha>
Original-branch: dev
Mainline-reset: 2026-06-06
```

## Tracing Blame Through Archives

A normal blame on `main` answers which integrated change introduced a line:

```bash
git blame -- path/to/file
```

If the blamed commit is a squash commit, inspect its archive trailers:

```bash
git show <squash-sha>
```

Then use the archived branch to inspect feature-level history:

```bash
git blame archive/260606-feat-crawler-preview-routing -- path/to/file
git log --oneline <feature-base-sha>..<feature-tip-sha>
```

This workflow intentionally separates two questions: `main` blame answers which
completed feature, fix, or refactor introduced a line; `archive/*` blame answers
which internal feature commit introduced it.
