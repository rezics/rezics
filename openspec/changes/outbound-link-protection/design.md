## Context

Today the codebase renders links three different ways:
1. Raw `<a href="…">` in JSX (most common — appears in `package/app`, `package/admin`, `package/app-shell`, and inside markdown render output).
2. TanStack Router `<Link to="…">` for in-router navigation (used inside the app router's TS-typed routes).
3. Whatever the markdown renderer emits for `[text](url)` — currently a raw anchor with a passthrough `href`.

There is no shared classifier that decides "is this an internal route, a rezics-domain page, or an external URL?" Each call site picks its own attributes (or omits them), so `rel`, `target`, and click behavior are inconsistent. The site has been growing user-authored prose surfaces — review bodies, post bodies, profile fields, and soon excerpt sources — which raises the cost of leaving this loose.

The convention enforcement script (`tool/scripts/check-convention.ts`) already runs as a pre-commit hook and PR merge gate (per `convention-enforcement` spec). It enforces folder and route conventions today and is the natural home for a "no raw `<a>`" rule, since the project does not use ESLint (Biome handles linting, but ban-specific-jsx-elements is not a built-in Biome rule and adding a Biome 2.x plugin for one rule is heavier than extending a script that already exists).

The change is motivated by the upcoming excerpt-source feature (`post-excerpt-and-unit-resolver`), which adds a `source.url` field that may point at any URL. That feature needs the protection layer to exist, and building the layer narrowly for excerpts would miss the opportunity to fix the rest of the site at once.

## Goals / Non-Goals

**Goals:**
- One primitive every JSX `<a>`-shaped call site goes through, so `rel`, `target`, and external-link behavior are uniform.
- Real `href` in the rendered DOM, so middle-click, copy-link, and right-click flows work normally and the link is honest about its destination.
- A confirmation modal on external destinations that names the host, giving users awareness before leaving the site.
- A single classifier (`classifyUrl`) usable on backend, frontend, and tooling so the "what counts as internal" rule has one definition.
- Convention enforcement that prevents regression: the pre-commit and PR gate fail if a new raw `<a>` lands outside the allowlist.

**Non-Goals:**
- Not a security boundary. A determined user can copy the `href` and paste it into the address bar; the modal exists for awareness, not enforcement. (External-content sandboxing, malware blocking, and CSP work are separate concerns.)
- No URL allowlist or blocklist in this change. The classifier exposes a hook for future per-host policy, but no list of "blocked hosts" or "trusted partners" is shipped.
- No tracking-parameter stripping (utm, fbclid, etc.). Out of scope.
- No URL preview / unfurl on hover. Out of scope.
- No interstitial *page* (the Steam / Facebook redirect-page pattern). The modal is in-app, client-side. Server-side `/go?to=…` is not implemented.
- No analytics on outbound clicks in this change. The modal store is structured so it can fire an event, but no event sink is wired up here.
- No special handling for `mailto:`, `tel:`, or `javascript:` schemes — they fall through the classifier as "external" and trigger the modal. (`javascript:` URLs are also blocked at the classifier level as malformed.)

## Decisions

### D1 — Hybrid client-side modal over server-side interstitial

**Decision:** External links are intercepted in-app by a click handler that opens a modal. The `href` attribute remains the real destination URL.

**Alternatives considered:**
- *Server-side `/go?to=…` redirect endpoint.* Works without JS, persists in copied/exported links, used by Steam and old Facebook. Rejected because (a) it adds an HTTP round-trip and full page render before every external click, (b) the visible `href` becomes the wrapped URL which users dislike, and (c) for a content site with no untrusted JS sandbox to defend, the in-app modal achieves the same UX goal at a fraction of the cost.
- *Pure `rel`-only protection (GitHub style).* Sets `rel="noopener noreferrer"` and stops there. Rejected because the proposal explicitly wants user awareness ("you are leaving rezics") in addition to the security defaults.

**Why hybrid is honest:** The modal is best-effort. Middle-click, copy-link, and address-bar paste bypass it. We document that explicitly so no one mistakes it for a security control.

### D2 — Classifier in `@rezics/contract`

**Decision:** `classifyUrl(raw: string): { kind: 'app-route' | 'rezics' | 'external', href: string }` lives in `@rezics/contract` (or a shared util module re-exported there).

**Alternatives considered:**
- *Classifier in `@rezics/ui` next to the component.* Rejected because backend code may also need to classify (e.g., when generating notification emails with embedded links, when validating user-supplied URLs at API boundaries), and the convention check script needs the same logic.
- *Three separate classifiers per consumer.* Rejected — that is the status quo we are fixing.

**Rules:**
- Starts with `/` and matches an in-app route shape (`/[a-z]`) → `app-route`. The `<Link>` component then renders TanStack Router's `<Link to>`.
- Otherwise parsed as a URL with a defaulted `https://` scheme. If parse succeeds and host is `rezics.com` or ends with `.rezics.com` → `rezics`. (Subdomain enforcement uses the dot-prefix check to reject `rezics.com.attacker.com`.)
- Otherwise (or parse fails) → `external`. Malformed inputs are treated as external, since the modal is the safer fallback.
- `javascript:`, `data:`, `vbscript:` schemes return `external` with a sentinel that the `<Link>` primitive uses to refuse rendering altogether (renders the link text as plain text, no anchor).

### D3 — Modal mounted once per app, opened via store

**Decision:** Each app shell (`package/app`, `package/admin`) mounts one `<ExternalLinkModal>` near the root. The `<Link>` primitive opens it by writing to a tiny store (Jotai atom in `package/ui`).

**Alternatives considered:**
- *Modal rendered inside each `<Link>`.* Rejected — N anchor instances on a page would create N modal mount points; only one is ever visible.
- *React Context.* Rejected — adds a provider requirement that's easy to forget and gives no value over an atom.

The store holds: `{ pendingHref: string | null, pendingHost: string | null }`. The component reads, renders the modal when `pendingHref` is non-null, and clears the store on Cancel or Continue.

### D4 — `href` stays the real URL in DOM

**Decision:** `<Link href="https://example.com">` renders `<a href="https://example.com" rel="noopener noreferrer" target="_blank" onClick={openModal}>`. The href is the destination, not a wrapped `/go?to=…` URL.

**Why:** Middle-click, copy-link, right-click, and screen-reader behavior all depend on the real href being present. The modal is left-click only.

**Trade-off:** A user who middle-clicks bypasses the modal. That is acceptable — middle-click is a deliberate "I know what I'm doing" gesture. Documented.

### D5 — Markdown renderer maps anchors to `<Link>`

**Decision:** Wherever the app renders markdown output (post bodies, review bodies, comments, profile fields, excerpt source titles in the future), the renderer's anchor handler emits `<Link href={url}>{text}</Link>` instead of a raw `<a>`.

This is the highest-leverage integration point — most user-authored links come through here. Doing it once at the renderer level means individual call sites don't have to think about link protection.

### D6 — Convention rule R5 in `check-convention.ts`, not a Biome plugin

**Decision:** Extend `tool/scripts/check-convention.ts` with R5: raw JSX `<a href=…>` is forbidden outside an allowlist of files (the `<Link>` primitive itself, plus narrow exceptions captured in `tool/scripts/expected-violations.json`).

**Alternatives considered:**
- *Biome 2.x plugin (GritQL).* Editor-integrated diagnostics are nicer, but Biome's plugin model for one bespoke rule adds a maintenance surface and allowlisting is more awkward than the script's existing per-path allowlist mechanism. Revisit if Biome plugin authoring becomes routine in this repo.
- *Codemod once, trust developers thereafter.* Rejected — without a gate, regression is inevitable as new files are added.

**Implementation:** The check is a regex/AST scan for `<a\s[^>]*href=` in `.tsx` files. False positives (string literals containing `<a href`) are rare; if they bite, promote the regex to a tiny AST scan via the TypeScript compiler API or `oxc-parser`. The snapshot mechanism (already used by R1–R4) lets the initial migration land incrementally.

### D7 — Ungrandfathered violations require explicit Link migration

**Decision:** During implementation, the audit either (a) replaces the raw `<a>` with `<Link>` or (b) adds it to `expected-violations.json` with a comment explaining why. There is no third option — no "we'll get to it later."

**Why:** The snapshot file is the migration ledger. An entry there is a TODO with file + line that anyone can pick up. A "later" without an entry is invisible work.

## Risks / Trade-offs

- **[Risk] Bypass via middle-click / copy-link.** → Acknowledged. Documented in the design and proposal as best-effort UX, not enforcement. The `rel="noopener noreferrer"` defaults still apply because they are HTML attributes, not JS-gated.

- **[Risk] Modal fatigue on link-heavy pages.** → External links typically appear in user-authored prose, where each link is intentional. We do not expect the kind of link density (e.g., 50 external links in one viewport) where modals become friction. If this surfaces, options include: a per-session "don't ask again for `<host>`" cookie, or auto-confirming for hosts the user has continued to before. Not in this change.

- **[Risk] Markdown renderer integration coverage.** → Multiple markdown renderers may exist across editor packages. The audit task explicitly enumerates every renderer entry point and points each one at `<Link>`. The R5 convention rule catches anything that gets reintroduced.

- **[Risk] False positives in R5 regex.** → A `.tsx` file containing the string literal `"<a href"` would match. Low likelihood (such literals are rare in this codebase), but if it happens we either add the file to the snapshot or swap the regex for a tiny AST scan. Not a blocker for landing.

- **[Risk] App-route classifier mis-classifies.** → A user-authored markdown link starting with `/` (e.g., `/foo/bar` typed by a user, not an actual app route) is classified as `app-route` and routed through TanStack Router, which would 404. → Acceptable: 404 is fine for typoed or invented in-app paths. The alternative (treating user-supplied root-relative paths as external) breaks legitimately useful in-app linking from prose.

- **[Trade-off] Single host displayed in modal, not the full URL.** → The modal shows `external.com`, not `https://external.com/path?utm=foo&ref=bar`. Hosts are what users use to assess trust; full URLs are noise. A "show full URL" disclosure could be added later if needed.

- **[Trade-off] No interstitial page for non-JS contexts.** → Users on RSS, email, or other non-JS surfaces see the raw href and click through directly. Acceptable: these contexts are not where link-clicking happens for the typical user, and the rel attributes still apply on render.

## Migration Plan

1. **Land the primitive.** Build `<Link>`, `<InternalLink>`, `<ExternalLink>`, `classifyUrl`, the store, and the modal. Verify in isolation (tests + a manual smoke route).
2. **Mount the modal once per app shell.** `package/app` and `package/admin` each get one `<ExternalLinkModal>` near the root.
3. **Point markdown renderers at `<Link>`.** Single change in each renderer's anchor handler.
4. **Audit raw `<a>` usages.** For each match: (a) replace with `<Link>`, or (b) add to `expected-violations.json` with a one-line reason.
5. **Land R5 in `check-convention.ts` and the updated snapshot.** With audit complete, the gate becomes hard.
6. **Document.** Add a short note to `CLAUDE.md` (link convention) so future contributors and Claude know about `<Link>`.

Rollback: revert the R5 commit to disable enforcement; the `<Link>` primitive itself is a passive replacement and does not need to be unwound.

## Open Questions

- **Should rezics-domain links bypass the modal entirely?** Current design: yes, they classify as `rezics` (not `external`). This is the right default — the user is staying within the rezics ecosystem. Confirm during implementation review.
- **Where does the markdown renderer currently live?** Implementation task includes a discovery step to locate every renderer entry point before pointing them at `<Link>`. May reveal that we have multiple parallel renderers worth consolidating; that consolidation, if substantial, is its own follow-up.
- **Any per-host policy to ship in v1?** Default position: no. The hook exists; populating it can wait for a real need.
