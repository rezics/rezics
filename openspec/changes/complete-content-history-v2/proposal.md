## Why

The history service has the core v2 storage and ingestion substrate, but the product surface is still incomplete: Book content-structure edits are not captured as useful domain history, revision comparison is raw/payload-oriented, and the app cannot yet provide a wiki-grade history experience.

This change completes content history as a user-facing collaborative editing capability: audited editorial revisions, structure events, reference/actor resolution, compare, restore, and a polished React history UI.

## What Changes

- Complete content-history read contracts so clients can list, inspect, and compare editorial revisions and structure events without relying on raw JSON.
- Record `BookContentStructure` saves as structure-history batch events derived from the existing diff-based TOC save path.
- Standardize history visibility, restore eligibility, raw-payload visibility, and authority behavior for locked fields.
- Add batch actor/reference resolution for history displays so timelines show usable names, avatars, labels, and deleted/restricted fallbacks instead of UUID-only output.
- Build a product-grade history UI in `package/app` with revision timeline, directory-event timeline, authority timeline, revision detail, compare, and restore entry points.
- Use frontend-side compare by default:
  - `diff`/jsdiff for source diff generation.
  - A React diff renderer such as `react-diff-view` for split/unified display.
  - `Intl.Segmenter` with optional `@formatjs/intl-segmenter` polyfill for CJK and other languages without whitespace word boundaries.
- Keep rendered Markdown DOM diff out of scope for this change; Markdown compare is source-level with optional preview.
- Keep full historical BookContentStructure state reconstruction and snapshot optimization out of the first implementation phase, while preserving API room for a future `structure-state?sequence=` read.

## Capabilities

### New Capabilities

- `history-product-ui`: User-facing app history surfaces for timelines, revision detail, compare, restore, structure events, authority events, empty/loading/error states, and raw-payload admin affordances.
- `revision-compare`: Frontend revision comparison behavior, including field-level diffing, Markdown source diff rendering, CJK-aware inline tokenization, and non-text collection comparisons.
- `history-reference-resolution`: Batch resolution of actors and referenced Units for history displays, including deleted, gone, and restricted fallbacks.

### Modified Capabilities

- `content-history-service`: Complete read DTOs and behavior for revision/event timelines, content-addressed editorial snapshots, BookContentStructure batch events, ingestion lag, and raw payload exposure.
- `type-extension-book`: Record diff-based `BookContentStructure` saves as history structure events while preserving normalized node storage and TOC write semantics.
- `content-authority`: Define history visibility, restore authority, raw payload visibility, lock behavior during restore, and admin/maintainer capabilities.

## Impact

- Affected packages:
  - `package/contract`: history DTOs, compare/view model contracts, structure-event payload types, history reference resolution schemas, authority permission contracts.
  - `package/server`: `BookContentStructure` history outbox writes, authority checks for history restore/raw access, actor/reference resolution endpoints, tests.
  - `package/history`: read APIs and revision/event DTO shape updates, ingestion idempotency expectations, structure-event persistence tests.
  - `package/api`: history queries/mutations, compare helpers, resolution API client, TanStack Query keys.
  - `package/app`: product-grade history routes, timeline/detail/compare/restore UI, diff rendering dependencies, responsive states.
  - `package/ui` if shared Markdown/diff primitives are promoted out of app-local code.
- New frontend dependencies are expected for diff rendering and optional segmentation polyfill. The default diff algorithm dependency is `diff`.
- Backward compatibility:
  - Existing history revisions/events remain readable.
  - Existing `UnitRevision` and `StructureEvent` records may lack newer display metadata and SHALL render through fallback paths.
  - Existing BookContentStructure rows require no schema migration for this change; only new saves begin emitting structure history unless a backfill task is explicitly added later.
- Migration needs:
  - No destructive data migration is required for the first implementation.
  - Optional historical backfill for current BookContentStructure state may be added as a seed/import task, but the product UI SHALL handle "history begins from first captured edit."
