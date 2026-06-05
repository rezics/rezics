Goal: Complete every actionable proposal currently in `plan/proposal/` using the `rezics-apply` workflow, then explicitly stage task-owned changes and commit them.

  Before editing:
  - Read `AGENTS.md`.
  - Read `.agents/skills/rezics-apply/SKILL.md`.
  - Read `.agents/skills/git-commit/SKILL.md`.
  - Inventory all proposal files currently under `plan/proposal/`.
  - Ignore proposals that are no longer present.

  Implementation order:
  1. `extract-comment-feature.md`
  2. `comment-tree-ranking-cutover.md`
  3. `shelf-item-collection-cutover.md`
  4. `feed-row-system.md`
  5. `share-reference-counts.md`
  6. `sequin-cdc-admin-ops.md`
  7. `crawler-preview-edge-routing.md`

  Dependency rules:
  - `extract-comment-feature` goes first because it is a localized frontend refactor that clarifies the app-side `comment` / `post`
  boundary.
  - `comment-tree-ranking-cutover` goes before `feed-row-system` because feed sorting depends on ranking fields such as `bestScore`,
  `hotScore`, `topScore`, and `risingScore`.
  - `shelf-item-collection-cutover` goes after the comment cutover because shelf items need the settled comment identity/model, and
  before feed/share work because it replaces collection semantics with shelf-item membership and search projection.
  - `feed-row-system` goes before `share-reference-counts` so feed contracts/renderers stabilize before engagement count surfaces are
  expanded.
  - `sequin-cdc-admin-ops` and `crawler-preview-edge-routing` are mostly independent; do them after the core app/server/ranking/feed/
  share proposals unless a discovered code dependency requires reordering.

  For each proposal:
  - Follow `rezics-apply` strictly.
  - Route every durable requirement into its owning code location:
    - types/schemas/DB schema for shape, legal values, indexes, constraints
    - tests for behavior under conditions
    - concise owning-code comments for irreducible invariants, deliberate non-restrictions, or “why”
    - commit message for history, migration notes, and rename maps
  - Do not create or preserve a parallel spec corpus.
  - Do not invent behavior beyond the proposal.
  - Ground every task in the actual code before editing.
  - Finish each proposal atomically where feasible; do not half-migrate durable requirements.
  - Mark completed proposal task checkboxes as `[x]`.
  - Set proposal frontmatter `status: done` only when all task-owned work is complete or explicitly no longer applicable.
  - Leave external/manual validation tasks unchecked unless they were actually executed.

  Repo rules:
  - Runtime/package manager is Bun.
  - Respect existing package boundaries and feature layering.
  - API DTOs/types belong in `@rezics/contract`; frontend access belongs in `@rezics/api`; do not duplicate DTOs in app code.
  - For UI/JSX/CSS work, load and follow `rezics-design`.
  - Ignore unrelated dirty or untracked files.
  - Never revert, stash, clean, or overwrite unrelated user changes.

  Verification:
  - Run targeted tests for every changed package/domain.
  - Run proposal-required checks where relevant:
    - `bun run check:convention`
    - `bun run format:check`
    - `bun run check:tokens` if JSX/CSS/token-sensitive styling changed
    - package-specific tests such as `bun --filter=@rezics/app test`, ranking/search/server/reaction/admin tests as appropriate
  - Fix failures caused by this work.
  - If a verification step cannot be run locally or requires external infrastructure, leave the related proposal task unchecked and
  report it.

  Git workflow:
  - Use the `git-commit` skill rules to generate a conventional commit message.
  - Assess whether one commit is appropriate; if the final staged diff spans clearly unrelated concerns, split into sensible commits by
  proposal or tightly related proposal group.
  - Treat this prompt as authorization to commit automatically once the generated message is appropriate.
  - Commit the staged task-owned changes.

We are currently in the development stage, so there is no need to preserve compatibility with old code, old API shapes, old database schemas, or old data. Prefer clear internal cutovers over compatibility layers, dual writes, legacy fallbacks, or data-preserving migrations. Feel free to use the local Docker environment as needed, and feel free to reset the database.

When debugging, you may freely create test data if needed.

If you've forgotten the goal, read ./goal.md

Do not push code to github
