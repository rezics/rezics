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
| UnoCSS     | preset-wind4 (with `--rezics-*` token backing from Phase 3) |

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

---

## Gotcha — Bun `--cwd` orchestration trap

In Bun **1.3.11**, the global `--cwd` flag only accepts the `=` form. Running `bun --cwd package/ui run storybook` (space-separated) is parsed as `bun run --cwd package/ui storybook`, which `bun run` rejects (it has no `--cwd` flag) — bun prints the `bun run` help and exits non-zero. Under `concurrently -k`, that silent sibling failure tears down the host too, so the user sees `:6006` "exit silently" and concludes "dev composition is broken".

It is not Storybook v10, not `refs`, not Vite — it's the Bun script.

**Fix.** Use the workspace-native filter form in root scripts:

```jsonc
"storybook:all": "concurrently -k -n host,ui,editor,folio,admin,app -c blue,cyan,magenta,green,yellow,red \"bun run storybook:host\" \"bun --filter='@rezics/ui' run storybook\" ..."
```

`bun --filter='<pkg>' run <script>` resolves the workspace package and runs the script in its directory. Verified: all 6 instances boot to "Storybook ready!" concurrently, host serves at `:6006` with all 5 refs in the sidebar; `bun run build-storybook` produces 6 dists with exit 0.

**Cosmetic.** Bun's filter resolver emits `▲ unable to find package.json for @rezics/api` (and similar for `email`, `server`) on each filter invocation. Those packages do exist with valid `package.json`s — this looks like a Bun workspace-lookup quirk unrelated to the storybook setup. Harmless; left in place.

---

## Gotcha — cross-package `@/` alias resolution

Every workspace package defines `@/* → ./src/*` in its own `tsconfig.json`. That is intentional and *correct* for the monorepo: at publish time each package compiles independently, so `@/` is resolved away in the dist.

But while developing without a build step, when one package's storybook (e.g. `@rezics/app`) renders a story that imports `@rezics/ui` source containing `import { Button } from "@/shadcn/button"`, the storybook's Vite must resolve `@/` against **`@rezics/ui`'s** tsconfig, not the consumer's. The minimal `.storybook/vite.config.ts` we initially wrote knows nothing about either. Result: `Failed to resolve "@/shadcn/button" from package/ui/src/link/ExternalLinkModal.tsx`.

Note that the consumer's own application Vite config doesn't hit this because it runs `resolve: { tsconfigPaths: true }`, which Vite 8 supports natively — but Storybook builds its own Vite instance and that flag isn't set.

**Fix.** Vite 8 ships built-in tsconfig paths resolution. Set `resolve: { tsconfigPaths: true }` in each storybook's vite config — it walks each source file up to its nearest tsconfig and applies that file's `paths` mapping. So `@/` inside `package/ui/src/...` resolves via ui's tsconfig, while `@/` inside `package/app/src/...` resolves via app's. The aliases coexist because resolution is anchored to the source file's location.

```ts
// e.g. package/app/.storybook/vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [UnoCSS(), react()],
});
```

(We initially reached for the `vite-tsconfig-paths` plugin and it worked — but Vite emits a runtime hint that the same is now built-in. Built-in is one less dep and one less warning source.)

Verified: all 6 instances boot, all `iframe.html` endpoints return 200, admin and app stories that pull in `@rezics/ui` (which uses `@/shadcn/*` and `@/shared/lib/utils`) compile and render with no resolution errors.

---

## Output orchestration

Default `concurrently` output for 6 storybooks is unreadable: each instance prints a multi-line ANSI box-drawing "Storybook ready!" banner, each line gets a `[host] @rezics/ui storybook: │ │` triple-prefix, and 6 simultaneous boots interleave. The host URL gets buried.

**Fix — three pieces:**

1. **Per-instance silence.** Pass `--quiet --loglevel error` to every storybook invocation. With both flags set, a successful boot prints nothing — only errors come through. Crucially this is set on the **root orchestration** call (`bun --filter='@rezics/<pkg>' run storybook -- --quiet --loglevel error`), not in each package's own `storybook` script. Standalone debug boots (`bun --filter='@rezics/admin' run storybook`) keep the verbose banner.

2. **Custom ready-watcher.** `tool/scripts/storybook-banner.ts` polls each `:60xx/iframe.html` until 200, then prints one clean panel:

   ```
   ✓ rezics design system — all 6 storybooks ready

     Host    http://localhost:6006/  ← open this
     ui      http://localhost:6007/
     editor  http://localhost:6008/
     folio   http://localhost:6009/
     admin   http://localhost:6010/
     app     http://localhost:6011/
   ```

   Then awaits SIGINT indefinitely, so `concurrently -k`'s "kill on sibling exit" doesn't tear down the servers.

3. **Wire as 7th task.** Add the banner script to `concurrently` alongside the 6 storybooks with prefix `info`. Keep `-k` — any *server* dying still kills the others, which is what we want; the banner doesn't exit on its own.

Verified: `bun run storybook` produces ~12 lines of output total, banner prints ~5s after start with all URLs visible.

---

## Gotcha — Storybook 10.3.6 CORS issues on ref composition

When the host (`:6006`) loads a `refs` entry pointing at another Storybook (e.g. `http://localhost:6010`), the manager fetches **four** endpoints with `credentials: "include"`:

- `GET <ref>/index.json` — story manifest (current v10 path)
- `GET <ref>/project.json` — instance metadata (current v10 path)
- `GET <ref>/stories.json` — legacy v6 manifest (probed for backwards-compat)
- `GET <ref>/metadata.json` — legacy pre-v6 metadata (probed in `.catch`)

The legacy fetches are intentional: `manager-api/index.js`'s `checkRef` succeeds if either `index.json` or `stories.json` responds, and `metadata.json` is `.catch`ed. Functionally fine — but the way upstream emits headers breaks the browser console.

### Issue 1 — `/project.json` missing CORS headers (and `/index.json` incompatible with credentials)

In Storybook **10.3.6** (`node_modules/storybook/dist/core-server/index.js`):
- `/index.json` sets `Access-Control-Allow-Origin: *` (line 4680) — but the manager fetches with `credentials: "include"`, and `*` is **invalid** when credentials are sent. The browser silently drops the response.
- `/project.json` sets no CORS headers at all (line 5688) — outright rejected.

**Fix.** Patch via `bun patch storybook` (`patches/storybook@10.3.6.patch`). Both handlers now echo the request origin and add `Access-Control-Allow-Credentials: true` + `Vary: Origin`:

```diff
   app.use("/index.json", async (req, res) => {
-    res.setHeader("Access-Control-Allow-Origin", "*"), res.setHeader(
+    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*"),
+    res.setHeader("Access-Control-Allow-Credentials", "true"),
+    res.setHeader("Vary", "Origin"),
+    res.setHeader(
       "Access-Control-Allow-Headers",
       "Origin, X-Requested-With, Content-Type, Accept"
     ), res.end(JSON.stringify(index));
   });

   app.use("/project.json", async (req, res) => {
-    res.setHeader("Content-Type", "application/json"), res.write(JSON.stringify(storybookMetadata)), res.end();
+    res.setHeader("Content-Type", "application/json"),
+      res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*"),
+      res.setHeader("Access-Control-Allow-Credentials", "true"),
+      res.setHeader("Vary", "Origin"),
+      res.write(JSON.stringify(storybookMetadata)), res.end();
   });
```

### Issue 2 — `/stories.json` and `/metadata.json` 404 without CORS headers

Core-server v10 emits no handler for the legacy paths, so they fall through to Vite's catchall 404 — which sets no CORS headers. The browser raises a console-visible CORS error before the 404 is observable. The error is cosmetic (refs still load via `index.json`) but it floods the console.

**Fix.** Vite plugin in `package/storybook-config/src/index.ts` (`corsLegacyEndpointsPlugin`) intercepts both paths in dev mode and returns a CORS-correct 404. The manager's `handleRequest` treats 404 as `indexError`, falls back to `index.json`, and the network panel shows a gray 404 with no JS-level error.

```ts
const STORYBOOK_LEGACY_ENDPOINTS = new Set(["/stories.json", "/metadata.json"]);

function corsLegacyEndpointsPlugin(): Plugin {
  return {
    name: "rezics-storybook-cors-legacy-endpoints",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? "").split("?")[0];
        if (!STORYBOOK_LEGACY_ENDPOINTS.has(path)) { next(); return; }
        const origin = req.headers.origin;
        if (typeof origin === "string") {
          res.setHeader("Access-Control-Allow-Origin", origin);
          res.setHeader("Access-Control-Allow-Credentials", "true");
          res.setHeader("Vary", "Origin");
        }
        res.setHeader("Content-Type", "application/json");
        res.statusCode = 404;
        res.end(JSON.stringify({
          error: "endpoint removed in storybook 10",
          replacement: path === "/stories.json" ? "/index.json" : "/project.json",
        }));
      });
    },
  };
}
```

Bun applies the patch automatically on every `bun install`. Verified: `curl -I -H "Origin: http://localhost:6006" http://localhost:6010/project.json` returns `Access-Control-Allow-Origin: http://localhost:6006` + `Access-Control-Allow-Credentials: true`.

**Drop the patch when upstream fixes it.** When Storybook ships >10.3.6 with credentials-compatible CORS, remove `patches/storybook@10.3.6.patch` and the `patchedDependencies` entry. The legacy-endpoint plugin can also be removed if upstream stops probing v6 paths. Worth filing an upstream bug at https://github.com/storybookjs/storybook so this doesn't linger.
