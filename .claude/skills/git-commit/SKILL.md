---
name: git-commit
description: >
  Generate well-formatted Git commit messages following conventional commit standards.
  Use this skill whenever the user asks to commit changes, write a commit message, stage and commit,
  or says anything like "commit this", "generate a commit", "what should my commit message be",
  or "help me commit". Also trigger when the user is done with a coding task and naturally
  needs to save their work. Auto-detects the commit type from staged changes but always allows
  the user to override.
---
 
# Git Commit Message Skill
 
## Workflow
 
### Step 1 — Check for staged changes
 
Run:
```bash
git diff --cached --stat
```
 
- If nothing is staged → warn the user: *"No files are staged. Please use `git add` to stage your changes first."* Then stop.
- If staged → proceed.
 
### Step 2 — Inspect the diff
 
Run both:
```bash
git diff --cached --stat
git diff --cached
```
 
Use the stat for a high-level overview (files changed, insertions, deletions).
Use the full diff to understand *what* and *why*.
 
### Step 3 — Check for merge commit
 
Run:
```bash
cat .git/MERGE_HEAD 2>/dev/null
```
 
If a merge is in progress, generate a merge commit message instead — see **Merge Commits** section below.
 
### Step 4 — Assess commit scope
 
If the diff touches **many unrelated concerns** (e.g., a bug fix + new feature + config change), suggest splitting:
 
> "This diff seems to cover multiple concerns: [X, Y, Z]. Would you like me to suggest how to split these into separate commits?"
 
If the user says yes → list the proposed splits and stop. Let the user stage the first batch before proceeding.
 
Otherwise, continue with a single commit.
 
### Step 5 — Auto-detect commit type
 
Use the table below to infer the type from filenames, content, and patterns. Pick the best fit.
 
| Type       | Signals                                                                |
| ---------- | ---------------------------------------------------------------------- |
| `feat`     | New functions, classes, routes, UI components, capabilities            |
| `fix`      | Bug fixes, null checks, error handling, off-by-one corrections         |
| `chore`    | Dependency updates, config files, build scripts, `.gitignore`, tooling |
| `docs`     | `.md`, `.txt`, comments, docstrings, README changes                    |
| `refactor` | Renames, restructures, extractions — no behavior change                |
| `test`     | Test files, mocks, fixtures, coverage changes                          |
| `style`    | Formatting, whitespace, linting — no logic change                      |
| `perf`     | Caching, algorithm optimization, reduced complexity                    |
 
If uncertain between two types, pick the one that best represents the *primary intent*.
 
Present the auto-detected type to the user and invite override:
> "I've detected this as a `feat` commit. Let me know if you'd like a different type."
 
### Step 6 — Generate the commit message
 
Follow the format:
 
```
<type>(<optional scope>): <title>
 
- <bullet: why or what changed, high-level>
- <bullet: ...>
```
 
**Title rules:**
- Lowercase, no period at end
- Max 50 characters
- Clear and specific — no vague titles like "update" or "fix stuff"
 
**Body rules (optional but recommended for non-trivial changes):**
- Use when the diff needs context or reasoning
- Bullet points: concise, high-level, explain *why* not just *what*
- For large diffs: include a multi-line body summarizing each area of change
 
**Scope** (optional): a short noun indicating the area, e.g. `feat(auth):`, `fix(api):`.
 
### Step 7 — Determine whether to offer to commit
 
**CLI / Claude Code environment** (bash tools available):
- Offer to run `git commit` with the generated message.
- Say: *"Ready to commit with this message? I can run it for you."*
- If user confirms → run: `git commit -m "<title>" -m "<body>"`
- Never run the commit without explicit confirmation.
 
**Web / chat environment** (no bash execution):
- Just display the commit message in a copyable code block.
- Add a tip: *"Copy the message above and run: `git commit -m '...'`"*
- Do NOT prompt to commit — the user must do it themselves.
 
---
 
## Merge Commits
 
If a merge is in progress:
 
```
merge(<branch>): merge <source-branch> into <target-branch>
 
- Resolved conflicts in: <files if any>
- <any notable integration notes>
```
 
Keep it factual. Don't over-explain standard merges.
 
---
 
## Edge Case Reference
 
| Situation                       | Action                                                        |
| ------------------------------- | ------------------------------------------------------------- |
| Nothing staged                  | Warn and stop. Do not proceed.                                |
| Huge diff (many files/concerns) | Suggest splitting; ask user before generating one big message |
| Only whitespace/formatting      | Use `style` type                                              |
| Only comment/doc changes        | Use `docs` type                                               |
| Ambiguous type                  | Auto-detect best guess, invite override                       |
| Merge in progress               | Use merge commit format                                       |
| User dislikes generated message | Regenerate with their feedback; never argue                   |
 
---
 
## Format Quick Reference
 
```
feat(auth): add JWT login flow
 
- Implemented token validation against the public key endpoint
- Added middleware to attach decoded user to request context
```
 
```
fix(ui): handle null pointer in sidebar
 
- Sidebar crashed when user had no active org; added fallback to empty state
```
 
```
chore: update dependencies
 
- Bumped eslint, typescript, and vite to latest stable versions
```
 