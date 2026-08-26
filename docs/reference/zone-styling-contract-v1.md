# Zone styling contract 1.0.0

This document defines the complete public styling surface for Zone Blocks under
styling-contract version `1.0.0`. The machine-readable source of truth is
`ZoneStylingContract` from `@rezics/block`.

The styling contract uses Semantic Versioning independently from REZICS product
RomVer. Adding a compatible hook is a contract-minor change. Removing a hook,
renaming it, or changing its meaning is a contract-major change and requires
approved custom themes to be revalidated.

## Scope and Block roots

Theme rules apply only inside platform-owned `[data-zone-theme-scope]`
containment roots. Page and Dock are independently stored and independently
scoped; a theme never needs either document identity or globally unique Block
keys. Each scope uses paint containment, and every Block root publishes:

- `data-block-type` contains one of the Block types listed below.
- `data-style-role`, when present, contains the Block's bounded,
  author-assigned semantic role tokens.

Structural `_key` values are unique only among siblings in their containing
array. They are editor and renderer identities, not theme selectors, and are
not part of this public contract. Style roles have class-like semantics: one
role may intentionally match multiple Blocks and has no uniqueness guarantee.

Nested Blocks publish their own roots. A named part belongs to the Block root
that renders it; authors should qualify part selectors with the intended
`data-block-type` or `data-style-role` root.

## Stable Block parts and state

| Block type | Stable `data-part` values | Stable state attributes and values |
| --- | --- | --- |
| `portable-text` | `content` | — |
| `post-full-view` | `header`, `title`, `summary`, `content` | — |
| `unit-ref` | `link`, `card`, `cover`, `title`, `summary` | `data-appearance`: `inline`, `card`, `cover` |
| `unit-list` | `heading`, `view-all`, `items`, `item`, `action`, `loading`, `empty`, `error` | `data-layout`: `list`, `grid`, `carousel`; `data-item-size`: `sm`, `md`, `lg` |
| `search` | `form`, `query`, `submit`, `filters` | — |
| `feed` | `toolbar`, `items`, `item`, `continuation`, `loading`, `empty`, `error` | — |
| `menu` | `list`, `item`, `label`, `link` | `data-appearance`: `links`, `buttons`, `tabs`, `drawer` |
| `media` | `figure`, `asset`, `caption`, `link` | `data-appearance`: `content`, `cover`, `banner`, `avatar` |
| `divider` | `separator` | — |
| `columns` | `column` | — |
| `group` | `content` | `data-layout`: `stack`, `row`, `grid` |
| `callout` | `title`, `content` | — |
| `tabs` | `list`, `tab`, `panel` | — |

Parts may be omitted when the corresponding content or state is absent. An
`empty` or `error` part appears only for that outcome. Their presence is stable;
their element type and location in the private DOM tree are not.

Selectors are recursively validated. A selector using a Block part or state
must name exactly one explicit `data-block-type`; functional selector pseudo-
classes, private classes/IDs/type selectors, and document-global at-rules such
as `@layer` and `@keyframes` are not part of the authoring contract.

## Published custom properties

The Zone theme root publishes these CSS custom properties:

- `--rezics-zone-accent`
- `--rezics-zone-accent-foreground`
- `--rezics-zone-density`
- `--rezics-zone-card-radius`
- `--rezics-zone-heading-font-scale`
- `--rezics-zone-surface-tint`

The platform owns token resolution, including the accessible accent foreground
and the concrete CSS values represented by the bounded density, radius, font
scale, and tint tokens. A hero asset is rendered as platform-owned image markup;
it is not exposed as a CSS URL custom property.

## Private implementation details

Only the attributes, parts, state values, and custom properties listed in this
document are public. In particular, the following remain private and may change
without a styling-contract version bump:

- DOM element names, nesting, sibling order, and incidental wrappers
- CSS class names and generated utility classes
- structural Block/container `_key` values and any private
  `data-block-key` diagnostics
- SharkUI and Ark UI internals, including their `data-scope`, `data-part`, and
  `data-state` attributes
- React component boundaries, keys, and hydration details
- every node outside a `[data-zone-theme-scope]`; portaled Dock content creates
  its own scope and receives the same resolved theme tokens
- platform navigation, authentication, moderation, reporting, trust, rating,
  labeling, and management controls

Custom themes must not select private surfaces. JavaScript is never part of the
Zone styling contract and never executes as part of a Zone theme.
