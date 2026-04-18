## 1. Classifier (`@rezics/contract`)

- [ ] 1.1 Add `classifyUrl(raw: string)` to `package/contract/src/util/url.ts` with the discriminated return shape (`'app-route' | 'rezics' | 'external' | 'blocked'`); export from `package/contract/src/index.ts`.
- [ ] 1.2 Implement the host-suffix check using a dot-prefix comparison so `rezics.com.attacker.com` is rejected; default missing schemes to `https://`.
- [ ] 1.3 Reject `javascript:`, `data:`, `vbscript:` schemes as `blocked` (regardless of casing or whitespace).
- [ ] 1.4 Add `bun test` cases covering: app routes, rezics root, rezics subdomains, look-alike hosts, malformed input, blocked schemes (`package/contract/src/util/url.test.ts`).

## 2. Link primitive (`@rezics/ui`)

- [ ] 2.1 Create `package/ui/src/link/Link.tsx` exporting `<Link>`, `<InternalLink>`, `<ExternalLink>`. The generic `<Link>` calls `classifyUrl` and dispatches to one of the three branches; the wrappers skip classification.
- [ ] 2.2 The `app-route` branch SHALL render TanStack Router's `<Link to>`. Decide whether this is imported directly or injected via props/context to avoid a hard `@tanstack/react-router` dep in `@rezics/ui`; document the decision in a comment one-liner only if the choice is non-obvious.
- [ ] 2.3 The `external` branch SHALL render `<a href={href} rel="noopener noreferrer" target="_blank" onClick={openModal}>`; `blocked` SHALL render `<span>{children}</span>`; `rezics` SHALL render `<a href={href} rel="noopener noreferrer">`.
- [ ] 2.4 Re-export `<Link>`, `<InternalLink>`, `<ExternalLink>` from `package/ui/src/index.ts`.
- [ ] 2.5 Add `bun test` snapshot/render tests covering each classification branch and the blocked-scheme fallback.

## 3. External-link modal

- [ ] 3.1 Add a Jotai atom (or equivalent shared store) holding `{ pendingHref, pendingHost }` in `package/ui/src/link/store.ts`; expose `openExternal(href)` and `closeExternal()` actions.
- [ ] 3.2 Implement `<ExternalLinkModal>` in `package/ui/src/link/ExternalLinkModal.tsx` reading the store, displaying host (not full URL) plus Cancel and Continue buttons. Continue calls `window.open(href, '_blank', 'noopener,noreferrer')` then `closeExternal()`.
- [ ] 3.3 Keyboard accessibility: Esc closes, Tab cycles between buttons, Enter activates focused button. Destination host SHALL be selectable text.
- [ ] 3.4 Mount `<ExternalLinkModal>` once near the root of `package/app` and once near the root of `package/admin`.
- [ ] 3.5 Add a manual smoke route (under a dev-only path) that renders `<Link>` with each classification kind so the flow can be exercised end-to-end during review.

## 4. Markdown / rich-text renderer integration

- [ ] 4.1 Enumerate every renderer in the codebase that converts markdown links or rich-text anchor nodes to JSX (post body, comment body, profile fields, anywhere else `[text](url)` becomes an `<a>`). Capture the list in a comment in `tasks.md` after this audit if the count is large enough to be worth it.
- [ ] 4.2 Point each renderer's anchor handler at `<Link>` from `@rezics/ui`. Verify the post body renderer covers review, remark, and excerpt body content.
- [ ] 4.3 Verify that comments and profile-field rendering also route through `<Link>`.
- [ ] 4.4 Visual smoke: render a sample markdown with one in-app link, one rezics link, and one external link; confirm classification + modal behavior.

## 5. Codebase audit and migration

- [ ] 5.1 Run `rg '<a\\s+[^>]*href=' --type tsx -n package/` to enumerate every raw `<a href>` usage. Save the list as a working scratch file (do not commit).
- [ ] 5.2 For each match: replace with `<Link>` (preferred), or add an entry to `tool/scripts/expected-violations.json` under a new `r5` section with a `path`, `line`, and `reason` field.
- [ ] 5.3 Compile each affected package after migration: `cd package/<name> && bun run tsc --noEmit` (per-package, per the repo's tsc-per-package convention).

## 6. Convention rule R5 (`tool/scripts/check-convention.ts`)

- [ ] 6.1 Add R5 implementation: scan `.tsx` files under `package/` for `<a\s[^>]*href=` and report violations not on the file allowlist or in the snapshot.
- [ ] 6.2 Add the `<Link>` primitive file (`package/ui/src/link/Link.tsx`) to the per-rule allowlist constant inside the script.
- [ ] 6.3 Update `tool/scripts/expected-violations.json` schema to support an `r5` section if not already present; populate it from the audit step.
- [ ] 6.4 Update CLAUDE.md's "API Route & Folder Convention" section to reference the link convention and point to the `outbound-link-protection` spec.
- [ ] 6.5 Run `bun run check:convention` from repo root and confirm a clean exit. Run with a deliberately introduced raw `<a>` in a non-allowlisted file and confirm the script exits 1 with a clear message.
- [ ] 6.6 Verify the lefthook pre-commit hook still runs the check (`lefthook run pre-commit --files <changed-file>` if needed).

## 7. Validation

- [ ] 7.1 Per-package `bun run tsc --noEmit` clean across `package/contract`, `package/ui`, `package/app`, `package/admin`, `package/app-shell`.
- [ ] 7.2 `bun test` clean across packages with new tests.
- [ ] 7.3 `bun run check` (Biome) clean across the repo.
- [ ] 7.4 `bun run check:convention` clean.
- [ ] 7.5 Manual smoke: external `<Link>` opens modal on left-click, real `href` preserved on middle-click and copy-link, in-app `<Link>` navigates without modal, blocked-scheme `<Link>` renders as plain text.

## 8. Handoff to `post-excerpt-and-unit-resolver`

- [ ] 8.1 Confirm the `<Link>` API is stable enough to be consumed by the excerpt-source renderer in the next change. Document the intended call shape (`<Link href={source.url}>{source.title}</Link>`) in a one-line note inside the `outbound-link-protection` spec or design (no separate doc).
