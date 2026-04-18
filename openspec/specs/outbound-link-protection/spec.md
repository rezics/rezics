### Requirement: URL classification utility
The shared `@rezics/contract` package SHALL export a `classifyUrl(raw: string)` function that returns a discriminated value of the form `{ kind: 'app-route' | 'rezics' | 'external' | 'blocked', href: string }`. The classification rules SHALL be:
- `raw` starting with `/` followed by an alphanumeric path segment → `app-route`.
- `raw` parseable as a URL (defaulting `https://` if no scheme is present) whose host is `rezics.com` or ends with `.rezics.com` → `rezics`.
- `raw` whose scheme is `javascript:`, `data:`, or `vbscript:` → `blocked`.
- All other inputs (including malformed URLs) → `external`.

The `href` field on the returned value SHALL be the canonical href to render in the DOM (the original input for `app-route` and `rezics`, a parsed/normalized URL for `external`, and an empty string for `blocked`).

#### Scenario: App route
- **WHEN** `classifyUrl('/profile/me')` is called
- **THEN** the result has `kind === 'app-route'` and `href === '/profile/me'`

#### Scenario: Rezics root domain
- **WHEN** `classifyUrl('https://rezics.com/about')` is called
- **THEN** the result has `kind === 'rezics'`

#### Scenario: Rezics subdomain
- **WHEN** `classifyUrl('book.rezics.com/shelf/abc')` is called
- **THEN** the result has `kind === 'rezics'` and the missing scheme is treated as `https`

#### Scenario: Look-alike host rejected
- **WHEN** `classifyUrl('https://rezics.com.attacker.com/path')` is called
- **THEN** the result has `kind === 'external'`

#### Scenario: External URL
- **WHEN** `classifyUrl('https://example.com/article')` is called
- **THEN** the result has `kind === 'external'` and `href` is the input URL

#### Scenario: Malformed URL
- **WHEN** `classifyUrl('not a url')` is called
- **THEN** the result has `kind === 'external'` (safest default — it routes through the modal)

#### Scenario: Blocked scheme
- **WHEN** `classifyUrl('javascript:alert(1)')` is called
- **THEN** the result has `kind === 'blocked'` and `href === ''`

### Requirement: `<SafeLink>` primitive
The `@rezics/ui` package SHALL export a `<SafeLink>` component that accepts an `href` string plus standard anchor props (`children`, `className`, `aria-label`, `title`). It SHALL classify the href via `classifyUrl` and render:
- `app-route` → TanStack Router `<Link to={href}>` (or equivalent in-router navigation)
- `rezics` → `<a href={href} rel="noopener noreferrer">` (regular browser navigation, no `target=_blank` by default since this is still rezics)
- `external` → `<a href={href} rel="noopener noreferrer" target="_blank" onClick={openModal}>` where `openModal` opens the shared external-link modal
- `blocked` → renders `children` as plain text inside a `<span>`, with no anchor element

The component SHALL also export `<InternalLink>` and `<ExternalLink>` convenience wrappers that bypass classification when the call site already knows the destination kind.

#### Scenario: App route renders router Link
- **WHEN** `<SafeLink href="/book/123">view</SafeLink>` mounts
- **THEN** the rendered DOM uses TanStack Router's `<Link to="/book/123">` and clicking it navigates without a full page reload

#### Scenario: External link opens modal on left-click
- **WHEN** the user left-clicks `<SafeLink href="https://example.com">go</SafeLink>`
- **THEN** the default navigation is prevented and the external-link modal opens with `host = "example.com"`

#### Scenario: External link real href preserved
- **WHEN** an external `<SafeLink>` is rendered
- **THEN** the rendered `<a>` has `href="https://example.com"` (not a wrapped URL), so middle-click and right-click "open in new tab" navigate directly without the modal

#### Scenario: Blocked scheme renders as text
- **WHEN** `<SafeLink href="javascript:alert(1)">click</SafeLink>` mounts
- **THEN** the rendered output is `<span>click</span>` with no anchor element, no href, and no click handler

### Requirement: External-link confirmation modal
Each app shell (`package/app`, `package/admin`) SHALL mount exactly one `<ExternalLinkModal>` instance near the root. The modal SHALL be opened by the `<SafeLink>` primitive via a shared store (`useSyncExternalStore`-based store in `@rezics/ui`), and SHALL display:
- A heading conveying that the user is leaving rezics.
- The destination host (e.g., `example.com`), not the full URL.
- A **Cancel** button that closes the modal without navigating.
- A **Continue** button that calls `window.open(href, '_blank', 'noopener,noreferrer')` and closes the modal.

The modal SHALL be keyboard-accessible: Esc closes, Tab cycles between Cancel/Continue, Enter activates the focused button. The destination host SHALL be selectable text so users can copy it.

#### Scenario: Cancel does not navigate
- **WHEN** the modal is open and the user clicks Cancel
- **THEN** the modal closes, no new tab is opened, and the current page is unchanged

#### Scenario: Continue opens new tab
- **WHEN** the modal is open and the user clicks Continue
- **THEN** `window.open(href, '_blank', 'noopener,noreferrer')` is invoked and the modal closes

#### Scenario: Esc closes modal
- **WHEN** the modal is open and the user presses Esc
- **THEN** the modal closes without navigating

#### Scenario: Host displayed, not full URL
- **WHEN** the modal opens for `https://example.com/path?utm=foo&ref=bar`
- **THEN** the heading area shows `example.com` and not the full URL

### Requirement: Markdown and rich-text renderers route through `<SafeLink>`
Every renderer in the codebase that converts markdown `[text](url)` or rich-text anchor nodes to JSX SHALL emit `<SafeLink href={url}>{text}</SafeLink>` rather than a raw `<a>`. This applies to (at minimum):
- Post body renderer (review, remark, excerpt body content)
- Comment body renderer
- Profile field renderer (bio, links)
- Excerpt-source title renderer (in coordination with the `post-excerpt-and-unit-resolver` change)

#### Scenario: Markdown link in a post body
- **WHEN** a post body containing `[example](https://example.com)` is rendered
- **THEN** the resulting DOM contains a `<SafeLink>` instance whose classified kind is `external`, and clicking it opens the modal

#### Scenario: Markdown link to in-app route
- **WHEN** a comment containing `[my profile](/profile/me)` is rendered
- **THEN** the resulting DOM uses TanStack Router navigation and does not trigger the external-link modal

### Requirement: Bypass via middle-click and copy-link is acknowledged behavior
The protection layer SHALL preserve the real `href` on the rendered `<a>` for `external` links so that middle-click, right-click "open in new tab", and copy-link continue to navigate to the intended destination without involving the modal. The modal SHALL only be invoked on the default left-click path.

#### Scenario: Middle-click bypasses modal
- **WHEN** the user middle-clicks an external `<SafeLink>`
- **THEN** the browser opens the destination URL in a new tab and the modal does not appear

#### Scenario: Copy-link returns real href
- **WHEN** the user right-clicks an external `<SafeLink>` and selects "Copy Link"
- **THEN** the copied value is the real destination URL (not a wrapped URL)

### Requirement: Default `rel` and `target` policy
For non-`app-route` classifications, the rendered `<a>` SHALL include `rel="noopener noreferrer"`. For `external` classifications it SHALL also include `target="_blank"`. For `rezics` classifications `target="_blank"` SHALL NOT be set by default (the user is still inside the rezics ecosystem).

#### Scenario: External link rel attributes
- **WHEN** an external `<SafeLink>` is rendered
- **THEN** the `<a>` has `rel="noopener noreferrer"` and `target="_blank"`

#### Scenario: Rezics link rel attributes
- **WHEN** a rezics `<SafeLink>` is rendered
- **THEN** the `<a>` has `rel="noopener noreferrer"` but no `target="_blank"`
