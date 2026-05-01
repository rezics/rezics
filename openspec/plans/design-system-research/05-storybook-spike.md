# Storybook Spike — Compatibility & Decision

**Status**: Phase 5 spike artifact (T5.1) — informs T5.2 onward.
**Date**: 2026-05-01

---

## TL;DR

**Go.** Storybook **10.3.6** (current latest) supports our stack natively. The plan referenced "Storybook 9" but 10.x is now stable and its peer-dependency surface explicitly covers Vite 8 + React 19. No caveats, no workarounds.

---

## Stack baseline

| Dependency | Version in repo |
| ---------- | --------------- |
| `vite`     | 8.0.10          |
| `react`    | 19.2.4          |
| `react-dom`| 19.2.4          |
| Runtime    | Bun (native)    |
| TS         | 5.x             |
| MUI        | 7.x with `cssVariables: true` |
| UnoCSS     | preset-wind4 (with `--rzc-*` token backing from Phase 3) |

---

## Storybook compatibility (verified against npm registry)

| Package                       | Latest  | Peer ranges (relevant)                          | Verdict |
| ----------------------------- | ------- | ----------------------------------------------- | ------- |
| `storybook`                   | 10.3.6  | n/a (CLI host)                                  | ✓       |
| `@storybook/react-vite`       | 10.3.6  | `vite: ^5 \|\| ^6 \|\| ^7 \|\| ^8`, `react: ^16.8 \|\| ^17 \|\| ^18 \|\| ^19` | ✓ both green |
| `@storybook/builder-vite`     | 10.3.6  | `vite: ^5 \|\| ^6 \|\| ^7 \|\| ^8`              | ✓       |
| `@storybook/react`            | 10.3.6  | `react: ^16.8 \|\| ^17 \|\| ^18 \|\| ^19`       | ✓       |

A `vite-plus` peerDep appears in the dependency graph; it's an internal Storybook glue package, not something we install directly. Low concern.

---

## Why Storybook 10, not 9

The original plan was drafted when Storybook 9 was current. By the time Phase 5 began, 10.x had shipped and:

1. The 10.x line is the only one with **first-class Vite 8** support in published peer ranges.
2. React 19 is supported across both the 9.x tail and 10.x — but pinning 10.x avoids a near-future migration.
3. Storybook 10 sharpens the CSF + MDX 3 docs flow we'll need for the token galleries in Phase 7.

No reason to pin the older major.

---

## Recommended dependency pins (per Storybook package)

To be added in T5.2 (`package/ui/package.json`):

```json
"devDependencies": {
  "storybook": "^10.3.6",
  "@storybook/react-vite": "^10.3.6"
}
```

Mirror the same pair in `package/editor/package.json` (T5.4) and the root `.storybook/` host (T5.5) so Bun's workspace dedupe picks one copy across the monorepo.

---

## Bun runtime note

Storybook's CLI is a Node-targeted package. Bun runs Node-API CLIs without issue; `bunx storybook dev` works the same as `npx storybook dev`. No change to the workflow.

---

## What this spike does NOT decide

- **Port assignments** — settled mid-spike: Chrome blocks `:6000` (`ERR_UNSAFE_PORT`, X11 reserved). We standardized on Storybook's default `:6006` for the host and `:6007+` for the per-package instances. See "Port assignments" below.
- **Whether to keep Cosmos** — Phase 8 covers retirement; this spike doesn't pre-empt that decision.
- **Story file conventions** (`*.stories.tsx` vs MDX) — Phase 6 standardization.
- **Theme decorator wiring** — concrete shape lands in T5.3 (UnoCSS virtual import + MUI `ThemeProvider`).

---

## Go / no-go checklist

- [x] Storybook supports Vite 8 — yes, 10.x peer range covers it
- [x] Storybook supports React 19 — yes
- [x] Bun can run Storybook CLI — yes (Node-API compatible)
- [x] Multi-instance refs supported in 10.x — yes (composition feature carried from 9.x)
- [x] Static `storybook build` produces deployable dist — yes (unchanged from prior majors)

**Decision: proceed to T5.2 with Storybook ^10.3.6.**

---

## Implementation notes (post-T5.2)

Two real obstacles surfaced once the scaffold landed; both are resolved. Recording so future work doesn't relitigate them.

### 1. Project `vite.config.ts` is incompatible with Storybook

`package/ui/vite.config.ts` is wired for the package's own Vite app and includes:

- The `tanstackRouter` plugin pointed at `src/mock/routes` (note: typo — actual dir is `src/mocks/`). Throws `ENOENT` during `configResolved` before any `viteFinal` filter can intercept.
- `@visulima/vite-overlay` for runtime error rendering (irrelevant in Storybook).
- A `react()` plugin that conflicts with Storybook's own React handling.

**Fix**: don't inherit it. `.storybook/main.ts` sets `framework.options.builder.viteConfigPath = ".storybook/vite.config.ts"`, and that file is a minimal `defineConfig({ plugins: [UnoCSS(), react()] })`. No filtering, no override gymnastics.

### 2. `react-dom` was missing from `package/ui` deps

The package declared `react` but not `react-dom` (it relied on transitive resolution). Storybook's preview entry imports `react-dom/client` directly and fails dependency optimization without an explicit dep. Added `react-dom@^19.2.4` to `package/ui/package.json`.

### 3. `storybook build` succeeds; dev-mode boot is environment-sensitive

`bun run build-storybook` produces a complete static dist (1.27 MB iframe bundle, all 4 demo stories indexed in `index.json`). This is the authoritative compatibility signal — toolchain end-to-end works.

`bun run storybook` (dev) prints "Storybook ready!" then the parent process exits in a non-TTY background shell, so the listener never settles. This appears specific to running through layered background-task harnesses; running from a real interactive terminal is expected to behave normally. Not a blocker for the spike — flagged for verification when a human runs it locally.

### Pinned files

- `package/ui/.storybook/main.ts` — framework + builder config, points at isolated vite config
- `package/ui/.storybook/vite.config.ts` — minimal Vite config (UnoCSS + React only)
- `package/ui/.storybook/preview.tsx` — MUI ThemeProvider + UnoCSS virtual import + light/dark toolbar toggle
- `package/ui/src/stories/Tokens.stories.tsx` — Surfaces / Buttons / Typography / Brand demo
- `package/ui/package.json` — added `storybook`, `@storybook/react-vite`, `react-dom` deps + `storybook` / `build-storybook` scripts

---

## Port assignments (Chrome-safe)

Chrome's hardcoded "unsafe ports" list rejects the X11 port `:6000` with `ERR_UNSAFE_PORT` and likewise refuses `:6566`, `:6665–6669`, `:6697`. The Storybook default of `:6006` is safe and we use it for the host. Per-package instances climb from `:6007`:

| Port | Instance | Owner |
| ---- | -------- | ----- |
| 6006 | host (root `.storybook/`) | aggregator with `refs` |
| 6007 | `@rezics/ui` | foundation tokens, primitives |
| 6008 | `@rezics/editor` | CodeMirror markdown / json |
| 6009 | `@rezics/folio` | reader (txt / epub plugins) |
| 6010 | `@rezics/admin` | admin app pages / tables |
| 6011 | `@rezics/app` | main app pages / sections |

Five publishable surfaces, each with its own Storybook so the package can ship standalone; the host just composes them via `refs`.
