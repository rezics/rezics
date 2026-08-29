# Zone styling contract 3.0.0

This document is the authoring reference for custom Zone themes under styling
contract `3.0.0`. The machine-readable source of truth is
`ZoneStylingContract` from `@rezics/block`.

The styling contract uses Semantic Versioning independently from REZICS product
RomVer. Adding a compatible hook is a contract-minor change. Removing, renaming,
or changing a hook's meaning is contract-major and requires approved themes to
be revalidated.

## Scope and Block roots

The platform binds every reviewed stylesheet to its immutable revision and
prefixes every ordinary selector with the exact revision scope. Theme authors
do not write or depend on `data-zone-theme-scope` values. Page and Dock each
have a paint-contained root carrying the revision ID; selectors cannot cross
into another revision's scope.

Every Block contract root publishes:

- `data-block-type`, with one of the Block types below;
- zero to eight author-owned `rezics-theme-*` class names, emitted unchanged.

Custom class names are selectors, not style declarations. They do not generate
Tailwind CSS, have no platform-defined meaning, and are inert unless the active
reviewed stylesheet targets them. A Composition document may carry at most 256
custom class tokens. Tokens are unique per Block, at most 64 ASCII characters,
and must match `^rezics-theme-[A-Za-z0-9_-]+$`. Theme publishers should add a
theme-specific namespace, such as `rezics-theme-cassette--hero`.

Structural `_key` values are sibling-local editor identities, not selectors.
Nested Blocks publish their own contract roots.

## Selector policy

Theme CSS uses ordinary combinators and selector lists, with names bound to the
published contract:

- Class selectors must begin with `rezics-theme-`. Other classes, IDs, and the
  universal selector are rejected.
- Attribute selectors may use `data-block-type`, `data-part`, the state
  attributes in the table, `data-zone-surface="page" | "dock"`, and the
  presence-only `[data-portable-text]` boundary. Private boundary values are
  not published.
- A selector using a Block part or state must contain exactly one explicit
  `data-block-type` value or at least one reserved class hook. Explicit Block
  types enable part/state consistency checking.
- Supported pseudo-classes are `:active`, `:any-link`, `:checked`, `:disabled`,
  `:empty`, `:enabled`, `:first-child`, `:first-of-type`, `:focus`,
  `:focus-visible`, `:focus-within`, `:has()`, `:hover`, `:is()`,
  `:last-child`, `:last-of-type`, `:not()`, `:nth-child()`,
  `:nth-last-child()`, `:nth-last-of-type()`, `:nth-of-type()`,
  `:only-child`, `:only-of-type`, `:optional`, `:placeholder-shown`,
  `:required`, and `:where()`. Functional selectors are checked recursively.
- Supported pseudo-elements are `::after`, `::before`, `::first-letter`,
  `::first-line`, `::marker`, `::placeholder`, and `::selection`.

The reviewer admits nested ordinary rules only in `@container`, `@media`, and
`@supports`. It rejects imports and document-global names such as layers,
keyframes, fonts, and custom-property registrations. URLs may reference only
ready, public platform image assets declared by that immutable theme revision.

For example:

```css
.rezics-theme-cassette--hero > [data-part="content"] {
  min-block-size: 70svh;
}

[data-block-type="unit-list"][data-layout="grid"] [data-part="item"] {
  border-radius: var(--rezics-zone-card-radius);
}
```

## Rich-text elements

Type selectors are published only for semantic Portable Text output and only
after a preceding `[data-portable-text]` compound. The vocabulary is `p`, `h2`,
`h3`, `blockquote`, `ul`, `ol`, `li`, `a`, `figure`, `img`, and `figcaption`.

```css
[data-portable-text] > h2:first-of-type {
  font-size: calc(1.5rem * var(--rezics-zone-heading-font-scale));
}

[data-portable-text] li::marker {
  color: var(--rezics-zone-accent);
}
```

Portable Text can embed Blocks. A broad descendant selector such as
`[data-portable-text] p` can therefore also match a paragraph in an embedded
Block's private markup. Use child combinators or custom class hooks when that
distinction matters.

## Stable Block parts and states

| Block type | Stable `data-part` values | Stable state attributes and values |
| --- | --- | --- |
| `portable-text` | `content` | — |
| `post-full-view` | `header`, `title`, `summary`, `content` | — |
| `unit-ref` | `link`, `card`, `cover`, `title`, `summary` | `data-appearance`: `inline`, `card`, `cover` |
| `unit-list` | `heading`, `view-all`, `items`, `item`, `action`, `loading`, `empty`, `error` | `data-layout`: `list`, `grid`, `carousel`; `data-item-size`: `sm`, `md`, `lg` |
| `search` | `form`, `query`, `submit`, `filters` | — |
| `feed` | `toolbar`, `items`, `item`, `continuation`, `loading`, `empty`, `error` | — |
| `menu` | `list`, `item`, `label`, `link` | `data-appearance`: `links`, `buttons`, `tabs`, `drawer` |
| `image` | `figure`, `asset`, `caption` | — |
| `url-image` | `figure`, `asset`, `caption` | — |
| `divider` | `separator` | — |
| `columns` | `column` | — |
| `group` | `content` | `data-layout`: `stack`, `row`, `grid` |
| `callout` | `title`, `content` | — |
| `tabs` | `list`, `tab`, `panel` | — |

Parts may be absent when their content or state is absent. Their element type,
position, and private wrappers are not stable.

## Published custom properties and cascade

The scope publishes `--rezics-zone-accent`,
`--rezics-zone-accent-foreground`, `--rezics-zone-density`,
`--rezics-zone-card-radius`, `--rezics-zone-heading-font-scale`, and
`--rezics-zone-surface-tint`.

Reviewed theme CSS is injected unlayered. Normal unlayered declarations outrank
normal declarations in the application's native cascade layers, so themes do
not need artificial specificity. Layered application declarations marked
`!important` still outrank unlayered normal declarations; platform components
inside Zone scopes avoid important utilities for that reason.

## Private implementation details

DOM element names outside the rich-text vocabulary, DOM nesting, internal CSS
classes, utility and recipe classes, Block keys, private diagnostics, SharkUI
and Ark UI attributes, React boundaries, and every node outside a Zone theme
scope are private. Platform navigation, authentication, moderation, reporting,
trust, rating, labeling, and management controls remain outside selector reach.
JavaScript never executes as part of a Zone theme.
