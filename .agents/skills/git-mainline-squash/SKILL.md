---
name: git-mainline-squash
description: Generate final mainline squash commit messages with archive trailers.
metadata:
  version: 0.1.0
  license: AGPL-3.0-only
---

# Git Mainline Squash

Use this skill after a task branch is complete and ready to become one coherent
commit on `main`. This skill writes the commit message and checks the archive
metadata; it does not push, delete, rename, or otherwise mutate branches unless
the user separately asks for that operation.

## Routing

Use this skill only for final integration commits onto `main`, including
mainline snapshot commits and feature, fix, or refactor squash commits with
archive trailers.

For ordinary work-in-progress or task-branch commits, use `git-commit`. For
branch and worktree lifecycle operations, use `git-worktree`.

## Inputs

Gather or infer:

- Original branch, for example `feat/crawler-preview-routing`
- Archive ref, for example `archive/260606-feat-crawler-preview-routing`
- Feature base SHA and final feature tip SHA
- Optional PR number
- Final diff and enough context to explain the integrated result

If metadata is missing, state exactly which value is missing and show a draft
with placeholders rather than inventing SHAs or branch names.

## Message Shape

Use this structure:

```text
<type>(<optional scope>): <subject>

<body>

Archive-ref: archive/YYMMDD-type-topic
Archive-tip: <feature-tip-sha>
Feature-base: <feature-base-sha>
Original-branch: <original-branch>
Pull-request: #123
```

Omit `Pull-request` only when there is no PR. For one-off mainline cutovers,
use cutover trailers instead of feature trailers:

```text
chore: establish mainline snapshot

Create the new main integration baseline from the current repository state.

Archive-ref: archive/260606-mainline-dev-before-main
Archive-tip: <archived-dev-tip-sha>
Original-branch: dev
Mainline-reset: 2026-06-06
```

## Subject

The subject is the Conventional Commit first line. Pick the type from the
integrated result:

| Type | Use when |
| --- | --- |
| `feat` | Adds a user-facing or system capability |
| `fix` | Corrects broken behavior |
| `refactor` | Restructures code without intended behavior change |
| `perf` | Improves performance |
| `test` | Changes test coverage only |
| `docs` | Changes documentation only |
| `chore` | Repository, tooling, or operational maintenance |

Use a short noun scope when it clarifies the affected area. Keep the subject
lowercase after the type prefix, imperative/result-oriented, and without a
period.

## Body

The body is the GitHub squash UI's commit description. Generate it from the
final integrated change, not from the archive metadata.

- First paragraph: one sentence explaining the completed capability or outcome.
- Optional bullets: 2-5 high-level surfaces such as contract, server, app,
  migration, tests, or tooling.
- Keep body bullets contiguous; do not insert blank lines between list items.
- Do not describe routine process work such as rebasing, lint cleanup, or review
  iteration.
- Do not put archive details in the body; put them in trailers.

For a small change, a single body sentence is enough.

## Trailer Rules

Archive trailers are custom Git trailers. Keep each token stable and
dash-separated:

- `Archive-ref`: remote archive branch preserving development-level history
- `Archive-tip`: final commit SHA of the archived branch
- `Feature-base`: merge-base or recorded branch base before feature work began
- `Original-branch`: active branch name before archiving
- `Pull-request`: PR number, if any
- `Mainline-reset`: absolute date for repository baseline cutovers only

Never use fake SHAs. Prefer full 40-character SHAs when recording final
metadata; abbreviated SHAs are acceptable only in drafts.

## Output

Show the final message in a fenced block. If the user asked to commit, still ask
for explicit confirmation before running `git commit`.

When committing from the CLI, use one body argument or a commit message file for
multi-line bodies. Do not pass each body bullet as a separate `-m`; Git turns
separate `-m` arguments into separate paragraphs.
