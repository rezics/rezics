# Publishing capabilities

This document owns the author-to-reader outcomes for Posts, discussions,
Portable Text, Block documents, polls, structured content, revision history,
and Studio. It does not make every Post kind identical: shared lifecycle stays
common while each kind keeps its own content and targeting rules.

Planning context:

- [Outline: Post](https://outline.rezics.com/doc/post-3QOYo3B8aY)
- [Outline: Picture Post](https://outline.rezics.com/doc/picture-post-kind-JepIhOfZfH)
- [Outline: editor](https://outline.rezics.com/doc/editor-VZECJJ0GPB)
- [Outline: Block Schema](https://outline.rezics.com/doc/block-schema-6DHWS4d5SM)
- [Outline: content structure](https://outline.rezics.com/doc/content-structure-7TRHCUWAyU)
- [Outline: history](https://outline.rezics.com/doc/history-idDnb8eQ2e)
- [Outline: poll](https://outline.rezics.com/doc/poll-YRRqVoRpei)
- [Outline: Studio](https://outline.rezics.com/doc/studio-wiK6nk4n8U)

## Authoring and Post lifecycle

```progress
id: editor.portable-text-authoring
status: open
goal: Give authors an accessible, lossless editor for the approved Portable Text and Rezics Markdown contract.
depends:
  - localization.application-and-content
  - media.asset-lifecycle
accept:
  - Plain and rich editing preserve the same supported document meaning through parse, edit, serialize, save, reload, and render.
  - Unit mentions, links, media, custom blocks, language versions, keyboard use, undo, validation, and paste have explicit behavior.
  - Unknown or newer blocks remain recoverable and cannot be silently discarded by an older editor.
verify:
  - Run the portable-text library, Block validation, editor, mention-resolution, round-trip, and rendering tests.
  - Have a maintainer perform authoring acceptance for keyboard, assistive technology, paste, media, unknown-block, and recovery cases.
```

```progress
id: content.block-documents
status: open
goal: Use one versioned Block document contract for composable content while each host proves which references it may resolve.
depends:
  - editor.portable-text-authoring
accept:
  - Every persisted Block document has a versioned root, stable node keys, structural validation, and a host-specific policy.
  - Reference collection and resolution prove target kind, readability, and same-host rules before a document is stored or rendered.
  - Unknown, unavailable, recursive, duplicate-key, and oversized documents fail safely or preserve recoverable data as specified.
verify:
  - Run the Block library, domain-document, reference-resolver, host-policy, and renderer tests.
  - Exercise valid, unknown, cross-host, unreadable, recursive, duplicate, and oversized documents.
```

```progress
id: posts.core-publishing
status: open
goal: Let people draft, publish, localize, revise, read, and retire ordinary Posts through the live product.
depends:
  - catalog.unit-lifecycle
  - editor.portable-text-authoring
accept:
  - Post title, body, kind, status, visibility, target, Realm publications, credits, tags, media, and language versions use one transactional contract.
  - Create, detail, edit, list, feed, search, sharing, and deletion surfaces agree on public and private visibility.
  - Publication, cache invalidation, concurrent edit, validation, unavailable content, and rollback behavior are observable and tested.
verify:
  - Run Post schema, publication, targeting, localization, API, editor, detail, list, route, cache, feed, and search tests.
  - Complete draft-to-publish, multilingual edit, concurrent update, unpublish, and deletion journeys with separate viewers.
```

```progress
id: discussions.threaded-replies
status: open
goal: Let readers hold bounded threaded discussions on readable Units and Posts without corrupting reply ancestry.
depends:
  - posts.core-publishing
accept:
  - A reply records one semantic target and one display parent within one root; bounded semantic and display depths, stable ordering, visibility, and author identity are explicit.
  - Create, paginate, sort, collapse, edit, moderate, and delete behavior preserves both readable presentation and the meaning of the reply.
  - Cycles, cross-root parents, deleted ancestors, hidden semantic targets, blocked users, concurrent replies, inaccessible targets, and depth overflow fail safely.
verify:
  - Run semantic-target, display-tree, Post reply API, authorization, moderation, sorting, pagination, and presentation tests.
  - Exercise root replies, deep semantic replies flattened for display, boundary depths, deletion, hidden or inaccessible targets, and concurrent creation.
```

```progress
id: posts.picture-publishing
status: open
goal: Let authors publish one or more ordered images as a picture-first Post without introducing a duplicate Image Unit identity.
depends:
  - posts.core-publishing
  - media.asset-lifecycle
accept:
  - A Picture Post requires an ordered non-empty image sequence and supports localized title, description, alternative text, and captions.
  - Creation, validation, feed card, detail viewer, editing, sharing, collections, tags, reactions, and discussion use the Post identity.
  - Ordinary Posts, Reviews, and Chapters may contain images without being reclassified as Picture Posts.
verify:
  - Run Picture Post schema, publication, media-order, accessibility, feed, detail, and editing tests.
  - Complete single-image, multi-image, reorder, missing-alt, invalid-empty, and kind-boundary journeys.
```

```progress
id: posts.wiki-publishing
status: open
goal: Let communities maintain multilingual Wiki Posts as reusable knowledge pages rather than Zone-owned page content.
depends:
  - posts.core-publishing
  - access.unit-collaboration
accept:
  - Wiki creation, editing, publication, revision history, Realm access mode, navigation, entity relationships, and discussion use explicit contracts.
  - A Wiki may be reused across Units, Realms, and Zones without transferring ownership to a presentation surface.
  - Open, owner-managed, Realm-managed, restricted, historical, and removed Wiki states enforce the same policy in API and UI.
verify:
  - Run Wiki Post, Realm access, navigation, relationship, history, search, and web Wiki tests.
  - Exercise a multilingual Wiki through open collaboration, restricted collaboration, Realm publication, Zone display, revision, and removal.
```

The unresolved kind-wide targeting rules and Issue workflow remain tracked by
`posts.targeting-kind-policy` and `posts.issue-workflow` beside the owning Post
contracts.

```progress
id: messaging.direct-conversations
status: open
goal: Let consenting Profiles exchange private direct messages with clear participant, block, retention, and moderation rules.
depends:
  - identity.profiles-and-settings
accept:
  - A conversation has canonical participants and every message sender is an active participant.
  - Message send, pagination, read state, blocking, deletion, retention, reporting, and notification behavior preserve privacy.
  - Self-conversation, duplicate participant order, blocked delivery, unauthorized reads, retries, and concurrent sends are safe.
verify:
  - Run communication schema, messages API, block, notification, retention, and authorization tests.
  - Exercise start, duplicate start, send, retry, block, report, read, delete, and forbidden-access cases.
```

## Structured content and history

```progress
id: content-structure.book-and-media
status: open
goal: Let authors organize reusable Posts into validated Book and Media structures and let readers navigate them.
depends:
  - catalog.books
  - catalog.media
  - posts.core-publishing
accept:
  - Book trees and Media lists preserve node identity, parent ownership, ordering, optional reusable content, and kind-specific limits.
  - Draft editing, validation, publication, history, reader navigation, progress, and search projections share one structure meaning.
  - Cycles, cross-owner parents, missing content, stale edits, inaccessible chapters, and concurrent reorder operations fail safely.
verify:
  - Run content-structure contracts, storage, service, history, book/media draft, editor, reader, progress, and search tests.
  - Complete Book-tree and Media-list draft-to-read journeys including reuse, reorder, conflict, removal, and restoration.
```

```progress
id: content-structure.gamebook
status: open
goal: Let authors publish an acyclic GameBook choice graph and let each reader keep immutable, branchable Journeys.
depends:
  - content-structure.book-and-media
  - polls.unit-backed-options
accept:
  - Graph nodes reference Content Structure nodes, choices have stable immutable endpoints, and publication validates one entry, reachability, passage exits, endings, and acyclicity.
  - Journey Steps are immutable, branches share prefixes, one Journey is active per Profile and Book, and retries or concurrent choices remain idempotent.
  - Reader and author graphs expose current, explored, retired, and broken paths without copying Journey state into generic Unit progress.
verify:
  - Run graph validation, publication, Journey transaction, concurrency, statistics, retirement, reader, and authoring tests.
  - Reproduce the A-to-B-or-C-to-D acceptance journey from the Outline design, then retire one choice and verify history and recovery.
```

```progress
id: history.published-revisions
status: open
goal: Preserve readable published revision history for Units, Posts, structures, collections, and Docks with truthful visibility.
depends:
  - posts.core-publishing
  - content.block-documents
accept:
  - Each revision belongs to one aggregate, records actor and publication facts, and carries the payload needed for that aggregate kind.
  - History listing, comparison, visibility change, search projection, and restoration enforce current and historical access rules.
  - Draft saves do not masquerade as published revisions, and deleted or restricted history cannot leak through another route.
verify:
  - Run history storage, visibility, API, compare, content-structure, collection-structure, Dock, and web history tests.
  - Exercise publish, compare, hide, reveal, restore, delete, and forbidden historical access for every revision-bearing aggregate.
```

Discussion attached to a historical snapshot remains tracked by
`history.revision-discussions` in
`docs/architecture/content-structure-history.md`.

## Polls and Studio

```progress
id: polls.unit-backed-options
status: open
goal: Let people create and vote in polls whose ordered options reuse Unit identity and localization.
depends:
  - catalog.unit-lifecycle
accept:
  - An option references an existing readable Unit or creates a semantic Label Unit; option kind is never duplicated beside the Unit.
  - Poll mode, visibility, close state, result policy, option mutability, vote eligibility, and anonymity claims are explicit.
  - Single and multiple choice, retries, concurrent voting, option retirement, closing, counting, and result visibility are transactionally safe.
verify:
  - Run Poll schema, API, Label Unit, voting, aggregate, visibility, and web tests.
  - Exercise text and existing-Unit options across single, multiple, anonymous-display, close, retry, and concurrent-vote cases.
```

```progress
id: studio.content-workspace
status: open
goal: Give contributors one live workspace to find, create, filter, and resume every content type they may manage.
depends:
  - posts.core-publishing
  - catalog.unit-lifecycle
accept:
  - Studio sections list only content the current Profile may manage and preserve filters, language, status, and continuation.
  - Community-first creation searches for existing Units before offering a duplicate-safe creation path.
  - Draft, published, restricted, missing, and stale items have clear actions and recovery.
verify:
  - Run Studio service, projection, cursor, create feature, search-prompt, filter, route, and workspace tests.
  - Exercise new, returning, restricted, and high-volume contributor journeys against live data.
```

```progress
id: studio.event-automations
status: open
goal: Let authorized creators run isolated, observable automations after approved Rezics events.
depends:
  - studio.content-workspace
  - auth.third-party-oauth
accept:
  - Automation definitions bind a supported event to versioned code, secrets, permissions, network policy, owner, and enabled state.
  - Execution is isolated, time- and resource-bounded, idempotent where required, and records redacted logs and results.
  - OAuth-backed destinations such as Telegram can be authorized, revoked, retried, disabled, and audited without exposing credentials.
verify:
  - Run automation contract, isolation, permission, secret, event, retry, timeout, audit, and OAuth integration tests.
  - Exercise publish-to-Telegram success, duplicate event, revoked grant, script failure, timeout, and manual disable cases.
```

## Publishing milestone

```progress
id: publishing.v1-experience
status: open
goal: Make v1 creation, publication, revision, discussion, and structured reading complete from author to reader.
depends:
  - catalog.v1-experience
  - editor.portable-text-authoring
  - content.block-documents
  - posts.core-publishing
  - discussions.threaded-replies
  - posts.picture-publishing
  - posts.wiki-publishing
  - posts.targeting-kind-policy
  - polls.unit-backed-options
  - content-structure.book-and-media
  - history.published-revisions
  - studio.content-workspace
accept:
  - Authors can create every v1 Post kind and structured-content kind, publish it under exact access rules, and recover from validation or concurrency failures.
  - Readers receive accessible localized content, stable navigation, discussions, and truthful history through live contracts.
  - Feed, search, notification, moderation, and audit consumers see the same publication and visibility state.
verify:
  - Run publishing-related schema, service, API, generated-client, web, and production build checks.
  - Execute the author-to-reader acceptance matrix for every v1 Post and structured-content kind.
```
