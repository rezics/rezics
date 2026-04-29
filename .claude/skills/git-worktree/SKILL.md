---
name: git-worktree
description: >
  Manage the full lifecycle of git worktrees for parallel development. Use this skill when the user
  asks to "create a worktree", "spin up a parallel branch", "start parallel work on X", "open a
  sibling checkout", "merge a worktree back", "integrate the worktree branch", "clean up a worktree",
  or "list worktrees". Three modes: create (spin up a new sibling worktree on a fresh branch),
  merge (rebase + fast-forward back into the trunk by default, preserving full commit history),
  and list/cleanup (inspect and remove worktrees). Always confirms the start point and integration
  strategy with the user before executing destructive or history-altering commands.
---

# Git Worktree Skill

## Modes

Detect the user's intent from their phrasing + repo state, then enter the matching mode.

| Mode      | Triggers                                                                    |
| --------- | --------------------------------------------------------------------------- |
| `create`  | "create worktree", "spin up parallel branch", "new sibling checkout for X"  |
| `merge`   | "merge the X worktree back", "integrate worktree", "I'm done with worktree" |
| `list`    | "list worktrees", "what worktrees do I have", or ambiguous / no clear verb  |

If ambiguous → run `git worktree list` first, then ask the user which mode they want.

---

## Mode: `create`

### Step 1 — Confirm the starting point is the local HEAD

This is non-negotiable. The user must explicitly confirm the start commit before any worktree is created.

Run:
```bash
git rev-parse --is-inside-work-tree
git rev-parse --git-common-dir
git rev-parse --git-dir
git branch --show-current
git log --oneline -3
git status --short
```

Then present:

> "I'll branch the new worktree off your **local HEAD**:
> - Current branch: `<branch>`
> - HEAD commit:    `<short-hash>` — `<commit subject>`
> - Working tree:   `<clean | N modified files>`
>
> Confirm this is the start point you want? (yes / use a different branch or commit)"

**Do not proceed until the user confirms.**

If the user picks a different start point (e.g. "use `dev`", "branch from `abc1234`"), echo the resolved start commit back and ask for one more confirmation before continuing.

If the working tree is **dirty**, warn but do not block — worktrees can still be created. Note that uncommitted changes stay in the current worktree and will not be visible in the new one.

If the current process is running inside a **linked** worktree (i.e. `--git-dir` differs from `--git-common-dir`), warn the user and ask whether they want to anchor the new worktree's start point at this linked worktree's HEAD or at the main worktree's HEAD.

### Step 2 — Propose path + branch name

Suggest a sibling directory and a conventional branch name. Show both and wait for approval.

- **Path:** `../<repo-name>-<slug>` — sibling of the main worktree.
- **Branch:** `<type>/<slug>` — `feature/`, `fix/`, `chore/`, `refactor/`, `experiment/`. Pick `type` from context (the user's task description).

Example presentation:

> "Suggested:
> - Path:   `../rezics-dark-mode`
> - Branch: `feature/dark-mode`
> - Start:  `<short-hash>` (your local HEAD on `dev`)
>
> Approve, or give me a different path / branch name."

If the proposed branch already exists, surface that and offer a uniquified name (`feature/dark-mode-2`) — never silently overwrite.

### Step 3 — Create the worktree

After the user approves path + branch:

```bash
git worktree add <path> -b <branch> <start-commit>
```

Always pass the resolved start commit explicitly (not just `HEAD`) so the result is unambiguous in transcripts.

If the command fails (e.g. branch already checked out elsewhere), surface the error verbatim and ask the user how to recover. Do not retry blindly.

### Step 4 — Guide the user into the new worktree

Print absolute path + the exact commands the user should run **in a new terminal**:

> "Worktree ready at:
> ```
> <absolute-path>
> ```
>
> To work on it in parallel, open a new terminal and run:
> ```bash
> cd <absolute-path>
> claude
> ```
>
> Tip: this current Claude session stays on `<original-branch>` — anything I do here will not affect the new worktree, and vice versa."

Run a final `git worktree list` to confirm registration and show the user.

Do **not** attempt to `cd` into the new worktree from this session — Claude Code's working directory is fixed for the session, and pretending to switch causes confusion. The new worktree needs its own session.

---

## Mode: `merge`

### Step 1 — Identify the target worktree

Run `git worktree list`. If the user named a worktree (e.g. "merge dark-mode"), match it against the list. Otherwise ask which one. Resolve to a `(path, branch)` pair before continuing.

### Step 2 — Pre-merge sanity checks

Inside the target worktree, run:
```bash
git -C <worktree-path> status --short
git -C <worktree-path> log --oneline <trunk>..<branch>
```

- Working tree must be clean. If not, stop and suggest the `git-commit` skill or stashing.
- Confirm there is at least one commit ahead of the trunk. If zero, the worktree has nothing to merge — stop and tell the user.

Identify the **trunk** (target branch). Default heuristic:
1. Project's documented main branch — check `CLAUDE.md` or `git symbolic-ref refs/remotes/origin/HEAD`.
2. Fall back to `main` then `master`.
3. Confirm with the user before proceeding: *"Merging into `<trunk>` — correct?"*

### Step 3 — Choose the integration strategy

**Default: Rebase + Fast-Forward.** This produces a linear history on the trunk while preserving every individual commit from the worktree (each commit is replayed onto the new base; only the hashes change). This is the strategy you should propose unless the user overrides.

Present:

> "Default strategy: **Rebase + Fast-Forward**
> - Linear history on `<trunk>` — no merge commit, no branch divergence.
> - All worktree commits preserved individually (rewritten on top of `<trunk>`).
>
> Alternatives:
> - `--no-ff` merge: adds a merge commit, history shows the branch existed.
> - `--squash` merge: collapses all worktree commits into one new commit.
>
> Use the default, or pick an alternative?"

Strategy comparison:

| Strategy           | History on trunk    | Merge commit | Individual commits preserved |
| ------------------ | ------------------- | ------------ | ---------------------------- |
| **Rebase + FF** ★  | Linear              | No           | Yes (replayed, new hashes)   |
| `--no-ff` merge    | Diverge → converge  | Yes          | Yes (originals)              |
| `--squash` merge   | Linear              | No           | No (collapsed into one)      |

★ = default.

> **Warning before rebasing:** if the worktree branch has been pushed and may be in use by other developers, rebasing rewrites shared history. Ask the user explicitly: *"Has `<branch>` been pushed and shared? If yes, rebase will force-push and disrupt collaborators — switch to `--no-ff` instead."*

### Step 4 — Execute the chosen strategy

Show every command before running it. Pause on any non-zero exit.

#### Strategy A — Rebase + Fast-Forward (default)

Inside the **worktree** directory:
```bash
git -C <worktree-path> fetch origin <trunk>
git -C <worktree-path> rebase origin/<trunk>
```

If a conflict occurs, pause and surface:
> "Rebase paused on commit `<hash>` — `<subject>`. Conflicting files: `<files>`.
>
> Resolve in your editor, then run:
> - `git add <files>` followed by `git rebase --continue`
> - `git rebase --skip` (drop this commit — use only if intentional)
> - `git rebase --abort` (back out entirely)
>
> Tell me when you're ready to continue."

Once the rebase completes, fast-forward the trunk in the **main worktree**:
```bash
git -C <main-worktree> checkout <trunk>
git -C <main-worktree> pull --ff-only origin <trunk>
git -C <main-worktree> merge --ff-only <branch>
```

If `--ff-only` fails, the trunk has moved since the rebase. Re-run `git fetch` + `git rebase origin/<trunk>` in the worktree, then retry.

Push the trunk only if the user confirms:
> "Rebased and fast-forwarded `<trunk>` locally. Push to `origin/<trunk>`?"

#### Strategy B — `--no-ff` merge

```bash
git -C <main-worktree> checkout <trunk>
git -C <main-worktree> pull origin <trunk>
git -C <main-worktree> merge --no-ff <branch> -m "Merge <branch> into <trunk>"
```

On conflict, pause with the same recovery options (`merge --continue` / `merge --abort`).

#### Strategy C — `--squash` merge

```bash
git -C <main-worktree> checkout <trunk>
git -C <main-worktree> pull origin <trunk>
git -C <main-worktree> merge --squash <branch>
```

Then delegate the commit message to the **`git-commit`** skill — it will inspect the staged changes and propose a conventional commit message.

### Step 5 — Cleanup (offer, don't auto-run)

After successful integration, ask:

> "Integration complete. Clean up?
> - Remove worktree directory: `git worktree remove <worktree-path>`
> - Delete local branch:        `git branch -d <branch>`
> - Delete remote branch:       `git push origin --delete <branch>` (only if it was pushed)
>
> Run all / pick / skip?"

Run only what the user approves. Never use `--force` flags or `branch -D` without an explicit "force" from the user.

If `git worktree remove` refuses because of untracked files, surface the message and ask before re-running with `--force`.

---

## Mode: `list`

```bash
git worktree list
git worktree list --porcelain   # only if more detail is needed
```

Annotate each entry with: branch state (clean/dirty), commits ahead of trunk, last commit subject. Use this output to help the user decide whether they want to create another worktree, merge an existing one, or clean up stale ones (`git worktree prune`).

---

## Safety Rules (apply across all modes)

- **Never** run `git worktree remove --force`, `git branch -D`, `git push --force`, or `git push origin --delete` without explicit user confirmation in this session. Approval to do it once does not extend to other branches.
- **Never** rebase a branch the user has identified as shared/pushed-to-team without warning and re-confirmation.
- **Never** silently switch the trunk target. Always show `<trunk>` and confirm.
- **Always** show the exact command before running create / merge / remove / push operations.
- **Always** prefer pausing and asking over auto-recovery when a git command fails.
- If a `.git/MERGE_HEAD`, `.git/REBASE_HEAD`, or in-progress operation is detected in a worktree, refuse to start a new operation there until it's resolved.

---

## Troubleshooting

| Symptom                                                    | Recovery                                                               |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| `'<branch>' is already checked out at '<path>'`            | Use a different branch name, or remove the existing worktree first.    |
| Detached HEAD inside a worktree                            | `git -C <path> switch -c <new-branch>` to stabilise.                   |
| `git worktree remove` refuses (untracked / dirty)          | Surface to user; ask before `--force`.                                 |
| Rebase conflicts on many commits                           | Suggest interactive squash first: `git rebase -i HEAD~N`, then rebase. |
| `merge --ff-only` fails after rebase                       | Trunk moved; re-fetch + re-rebase in the worktree, then retry FF.      |
| Stale worktree directories deleted manually outside of git | `git worktree prune`                                                   |

---

## Quick Reference

```bash
# Create
git worktree add <path> -b <branch> <start-commit>

# Inspect
git worktree list
git worktree list --porcelain

# Integrate (default = rebase + FF)
git -C <wt> fetch origin <trunk>
git -C <wt> rebase origin/<trunk>
git -C <main> merge --ff-only <branch>

# Alternatives
git -C <main> merge --no-ff <branch> -m "..."
git -C <main> merge --squash <branch>      # then use git-commit skill

# Cleanup
git worktree remove <path>
git branch -d <branch>
git push origin --delete <branch>          # only if pushed + user confirms
git worktree prune                          # only if directories were deleted manually
```
