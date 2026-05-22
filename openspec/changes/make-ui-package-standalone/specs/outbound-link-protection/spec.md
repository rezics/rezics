## MODIFIED Requirements

### Requirement: `<SafeLink>` primitive

The `@rezics/ui` package SHALL export a `<SafeLink>` component that accepts an `href` string plus standard anchor props (`children`, `className`, `aria-label`, `title`). It SHALL classify the href via `classifyUrl` and render:

- `app-route` → a host-provided link renderer when one is supplied, otherwise a normal `<a href={href}>`.
- `rezics` → `<a href={href} rel="noopener noreferrer">` (regular browser navigation, no `target=_blank` by default since this is still rezics).
- `external` → `<a href={href} rel="noopener noreferrer" target="_blank" onClick={openModal}>` where `openModal` opens the shared external-link modal.
- `blocked` → renders `children` as plain text inside a `<span>`, with no anchor element.

The component SHALL also export `<ExternalLink>` convenience behavior for known external destinations. Router-bound internal link convenience wrappers SHALL live in the consuming app/admin shell or in an explicit adapter surface, not in the core safe-link primitive.

#### Scenario: App route uses host link renderer

- **WHEN** `<SafeLink href="/book/123" linkRenderer={AppLink}>view</SafeLink>` mounts in an app shell
- **THEN** the rendered output SHALL use the host-provided `AppLink` renderer
- **AND** clicking it MAY navigate without a full page reload according to the host router behavior

#### Scenario: App route falls back to anchor without host renderer

- **WHEN** `<SafeLink href="/book/123">view</SafeLink>` mounts without a host link renderer
- **THEN** the rendered output SHALL be a normal anchor with `href="/book/123"`
- **AND** `@rezics/ui` SHALL NOT import a router to render the link

#### Scenario: External link opens modal on left-click

- **WHEN** the user left-clicks `<SafeLink href="https://example.com">go</SafeLink>`
- **THEN** the default navigation is prevented and the external-link modal opens with `host = "example.com"`

#### Scenario: External link real href preserved

- **WHEN** an external `<SafeLink>` is rendered
- **THEN** the rendered `<a>` has `href="https://example.com"` (not a wrapped URL), so middle-click and right-click "open in new tab" navigate directly without the modal

#### Scenario: Blocked scheme renders as text

- **WHEN** `<SafeLink href="javascript:alert(1)">click</SafeLink>` mounts
- **THEN** the rendered output is `<span>click</span>` with no anchor element, no href, and no click handler

### Requirement: Markdown and rich-text renderers route through `<SafeLink>`

Every renderer in the codebase that converts markdown `[text](url)` or rich-text anchor nodes to JSX SHALL emit `<SafeLink href={url}>{text}</SafeLink>` or an equivalent host-adapted safe-link wrapper rather than a raw `<a>`. This applies to (at minimum):

- Post body renderer (review, remark, excerpt body content)
- Comment body renderer
- Profile field renderer (bio, links)
- Excerpt-source title renderer (in coordination with the `post-excerpt-and-unit-resolver` change)

The renderer or consuming shell SHALL provide host navigation capability when app-route links need SPA navigation.

#### Scenario: Markdown link in a post body

- **WHEN** a post body containing `[example](https://example.com)` is rendered
- **THEN** the resulting DOM contains a `<SafeLink>` instance or host-adapted safe-link wrapper whose classified kind is `external`
- **AND** clicking it opens the modal

#### Scenario: Markdown link to in-app route

- **WHEN** a comment containing `[my profile](/profile/me)` is rendered in an app shell with a host link renderer
- **THEN** the resulting DOM uses the host-provided app navigation behavior
- **AND** it does not trigger the external-link modal
