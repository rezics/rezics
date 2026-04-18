## Why

User-authored content across the app contains links — markdown bodies in posts and reviews, profile fields, future excerpt-source citations, and ad-hoc references in shell layouts. Today these render as bare `<a>` tags with whatever attributes the call site happened to set. There is no uniform `rel` policy (referer leaks, tabnabbing risk via `window.opener`), no warning before the user leaves rezics for an external destination, and no central place to add per-host policy in the future. The upcoming `post-excerpt-and-unit-resolver` change introduces a `source.url` field on excerpt posts that may point at any URL (rezics or external), which forces the question of how outbound links are rendered globally. Solving this once, in a primitive every consumer goes through, is cheaper and more honest than handling it per-feature.

## What Changes

### Link primitive
- Add a `<Link>` primitive in `@rezics/ui` that accepts an `href` string and classifies it at render time into one of three buckets: **app route** (in-router navigation via TanStack Router), **rezics domain** (full reload, treated as internal), or **external** (interstitial modal before navigation).
- Convenience wrappers `<InternalLink>` and `<ExternalLink>` exist for call sites that already know the classification, but the generic `<Link>` is the recommended entry point.
- All variants set `rel="noopener noreferrer"` and `target="_blank"` for non-internal destinations by default; the `href` attribute remains the real destination so middle-click and copy-link continue to work.

### URL classification utility
- Add `classifyUrl(raw: string)` to `@rezics/contract` (or a small shared util module re-exported there) returning a discriminated `{ kind: 'app-route' | 'rezics' | 'external', href: string }` value.
- Classification rules: starts with `/` → app-route; well-formed URL whose host equals `rezics.com` or ends with `.rezics.com` → rezics; otherwise → external. Malformed inputs are treated as external (safest default — they fall through to the modal).

### External-link modal UX
- Clicking an external `<Link>` calls `preventDefault` and opens a confirmation modal showing the destination host (not the full URL — host is what matters for trust). Buttons: **Cancel** and **Continue**. Continue calls `window.open(href, '_blank', 'noopener,noreferrer')`.
- The modal is shared (single mount in the app shell), opened via a tiny Jotai/Zustand store the `<Link>` primitive writes into. No prop drilling.
- Middle-click, copy-link, and right-click "open in new tab" bypass the modal by design — the real `href` is honored. The modal is a UX awareness layer, not a security boundary.

### Markdown / rich-text renderer integration
- The shared markdown renderer (used by post bodies, reviews, comments, profile fields, and the excerpt source — wherever user-authored prose appears) maps every `[text](url)` to `<Link>`.
- Rich-text editors that emit anchor nodes route those nodes through the same primitive on render.

### Convention enforcement (R5)
- Add R5 to `tool/scripts/check-convention.ts`: raw JSX `<a href=…>` is forbidden outside an explicit allowlist of files (the Link primitive itself, generated/vendored code, and any narrow exceptions captured in the snapshot).
- Initial migration: existing raw `<a>` tags either move to `<Link>` or land in `tool/scripts/expected-violations.json` as grandfathered exceptions, to be cleaned up as those files are touched.

### No backwards-compatibility shims
- The rendered DOM keeps `href` pointing at the real destination, so existing styles, tests that assert on `href`, and external tools that scrape link targets continue to work unchanged.
- No deprecation period for raw `<a>` — the convention rule is a hard fail from the moment R5 lands; the snapshot file is the only escape hatch.

## Capabilities

### New Capabilities
- `outbound-link-protection`: link rendering primitive, URL classification, external-destination modal UX, markdown/rich-text integration, host policy hook for future allowlist/blocklist work.

### Modified Capabilities
- `convention-enforcement`: add R5 (no raw `<a href>` outside the Link primitive allowlist) to the script's enforced rules.

## Impact

### Affected Packages
- `package/ui` — new `<Link>`, `<InternalLink>`, `<ExternalLink>` components; the shared external-link modal; the open-modal store.
- `package/contract` — new `classifyUrl` utility (so backend code, server-side rendering, and the convention script can share one classifier).
- `package/app`, `package/admin`, `package/app-shell` — replace existing raw `<a>` usages with `<Link>`; mount the external-link modal once in each app shell.
- Markdown / rich-text rendering surface (currently spread across `package/app` post and editor code) — point its anchor renderer at `<Link>`.
- `tool/scripts/check-convention.ts` — add R5 implementation.
- `tool/scripts/expected-violations.json` — grandfathered `<a>` violations recorded during the initial audit.

### Backward Compatibility
- None broken. `href` values, link text, and link styling are unchanged. The only observable user-facing difference is the confirmation modal on external links and the consistent `rel` attributes.
- No DB schema or contract type changes; no migration needed.

### Downstream Unblocks
- `post-excerpt-and-unit-resolver` consumes `<Link>` for excerpt-source rendering. Once this change lands, excerpt sources accept any URL (rezics or external) and inherit the protection automatically.
