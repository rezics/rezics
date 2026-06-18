---
title: Content Doc Schema Redesign
status: active
created: 2026-06-19
completed:
supersededBy:
tags: [contract, content-doc, markdown, editor, search, poll, mention]
---

## Why

Rezics content documents currently have two competing shapes:

- `doc-v1` is the runtime shape: one `main` Markdown block plus
  `beforeMain`/`afterMain` side regions for polls and unit references.
- `doc-v2` is a draft slot/layout shape that imports `doc-v1` and is not the
  runtime write/read contract.

That split makes content hard to reason about. It also forces product features
such as polls into artificial regions even though users experience them as
ordinary blocks in the document flow. Mentions are currently worse: the editor
inserts display text such as `@Alice`, which is readable but cannot preserve a
stable user identity when a name changes.

This proposal replaces both current content-doc shapes with one canonical
`rezics/content-doc` schema. It follows the naming and DB JSON direction from
`schema-component-system-redesign`: canonical Rezics JSON uses object-first
schema definitions, `kind` discriminants, `nodeId` for persisted in-document
node identity, no Portable Text `_type`/`_key`, and no compatibility layer for
development-stage experimental shapes.

The immediate editor remains Markdown-only. The schema supports three text
representations so DB JSON can be future-proof, but only Markdown is editable
and fully rendered by current product surfaces during the first implementation.

## Research and design signals

- [Portable Text](https://github.com/portabletext/portabletext) stores rich text
  as JSON blocks with typed children and mark definitions. Its `_type` and
  `_key` vocabulary is useful research, but it is a boundary dialect, not the
  Rezics DB shape.
- [GitHub Flavored Markdown](https://github.github.com/gfm/) is a formal
  CommonMark-based dialect. GitHub also performs post-processing and
  sanitization after Markdown is parsed. Rezics should follow that architecture:
  parse Markdown with an existing parser, then run Rezics-specific filters for
  links, mentions, references, and rendering.
- [cmark-gfm](https://github.com/github/cmark-gfm) is GitHub's CommonMark/GFM
  parser implementation. Rezics does not need that C implementation, but the
  design signal is important: the grammar is a parser concern; product concepts
  are pipeline plugins and post-processing.
- [RFC 9562](https://www.rfc-editor.org/rfc/rfc9562.html) defines UUIDv7 as a
  time-ordered UUID format. Rezics already uses DB-side `uuidv7()` for resource
  IDs. For client-created content blocks that need persistent editor identity,
  a browser/server helper wrapping `uuid` `v7()` is the right small dependency.
- Markdown's strength is source readability. It should not become a hidden
  carrier for every interactive product object. A mention can be a standard
  Markdown link because the link destination can store stable identity; a poll
  should be a document block because a poll is not Markdown text.

## Durable constraints & decisions

- `(type)` This is a clean cutover. Delete the current `doc-v1` runtime shape
  and the unused `doc-v2` draft shape. The new canonical envelope starts at
  `version: 1` with `schema: "rezics/content-doc"`.
- `(type)` Content docs use a single ordered `blocks` array. There is no
  `main`, `beforeMain`, `afterMain`, `slots`, or `layout` field in the canonical
  DB JSON.
- `(type)` Content block discriminants use `kind`, not `type`. Text
  representation discriminants also use `kind`.
- `(type)` Every top-level content block has a `nodeId`. It is opaque,
  system-minted, UUIDv7-shaped, scoped by the owning content doc, and exists for
  editor patching, reorder safety, block anchors, diffing, and diagnostics. It
  is not a database resource ID.
- `(comment)` `nodeId` does not replace real resource identity. A poll block
  still stores `pollUnitId`; a unit reference block still stores `unitId`; a
  mention link still stores a user ID in the link destination.
- `(type)` The text block supports exactly three text representations:
  `markdown`, `plainText`, and `structuredText`.
- `(comment)` Only `markdown` is editable in the first implementation. Product
  surfaces may display `plainText` through escaped text rendering and may
  project `structuredText` for search, but no full structured-text editor,
  renderer, or diff UI ships as part of this proposal.
- `(type)` Markdown mention storage is standard Markdown link syntax with a
  Rezics URI, for example `[@Alice](rezics://user/01972fd2-...)`. The user ID is
  the stable identity; the link label is a readable snapshot/fallback.
- `(comment)` Plain `@Alice` remains normal text. It must not trigger mention
  notifications or durable user references because it has no stable identity.
- `(type)` Mention extraction reads parsed Markdown links and structured text
  inline nodes, not regex matches over `@name`.
- `(type)` Markdown source must never store HTML as a persistence shortcut. The
  existing renderer setting `html: false` remains the default security posture.
- `(type)` Poll insertion is a content-doc block in `blocks[]`, not custom
  Markdown syntax and not a side region.
- `(type)` Unit references are also content-doc blocks in `blocks[]`, not
  Markdown syntax. Inline links to units may exist separately as Markdown links
  or structured text inline nodes, but block references remain explicit blocks.
- `(type)` External import/export adapters may translate Portable Text, HTML,
  or other formats into this canonical DB JSON. The DB must not store raw
  Portable Text `_type`/`_key` as its internal model.
- `(comment)` Search sync projects every content doc to Markdown-ish plain text.
  Markdown sources project as-is; plain text projects as escaped/plain text;
  supported structured nodes project to Markdown; unsupported structured
  objects append compact JSON so data is not silently dropped.
- `(comment)` Add code comments beside the projection helpers explaining the
  Meilisearch plan. This comment belongs in durable code because future
  implementers will otherwise be tempted to use `mainMarkdownSource`-style
  shortcuts again.
- `(type)` Existing `mainMarkdownSource` callsites must move to one of two
  clearer helper families:
  `contentDocEditableMarkdownSource()` for Markdown-only editor flows and
  `contentDocSearchMarkdownProjection()` for indexing/preview fallback.
- `(type)` New helper names must say what they do. Avoid generic `source`,
  `fallback`, or `main` wording because there is no main block after this
  cutover.
- `(type)` Schema source must be object-first: vocabulary arrays, concrete
  schema objects, maps, and assembled unions are the contract body. Functions
  such as `markdownContentDoc`, projection helpers, reference extractors, and
  factories are helpers that live after the schema definitions.
- `(type)` The canonical DB JSON uses `schema`, `version`, `blocks`, `kind`,
  `nodeId`, `text`, `source`, `nodes`, `pollUnitId`, `unitId`, `unitType`, and
  `uri`. It does not use `_id`, `_type`, `_key`, `id`, `key`, or bare `type` for
  content-doc node identity or variants.
- `(test)` Contract tests must reject unknown block kinds, unknown text kinds,
  extra properties, missing `nodeId` on blocks, empty mention target IDs, and
  malformed Rezics mention URIs.
- `(test)` Search tests must prove that Markdown, plain text, poll blocks, unit
  references, mentions, and minimally supported structured text all project into
  deterministic searchable text.

## Target canonical DB JSON

These examples are implementation anchors. If an implementation drifts away
from these examples, update the proposal first or explain the deliberate change
in the implementing commit.

### Markdown-only document

This is the default shape produced by current post/comment/review/description
editors.

```json
{
  "schema": "rezics/content-doc",
  "version": 1,
  "blocks": [
    {
      "kind": "text",
      "nodeId": "01972fd2-0ed8-7b7b-97f5-a4fc0e4d6b8d",
      "text": {
        "kind": "markdown",
        "source": "## Heading\n\nThis is **Markdown**."
      }
    }
  ]
}
```

### Markdown document with a user mention

The link label is readable and can be stale. The URI stores the durable target.
The renderer should resolve the latest display name when it can, while source
editing remains plain Markdown.

```json
{
  "schema": "rezics/content-doc",
  "version": 1,
  "blocks": [
    {
      "kind": "text",
      "nodeId": "01972fd2-26fa-72c0-930e-41ad486ab0a7",
      "text": {
        "kind": "markdown",
        "source": "Thanks [@Alice](rezics://user/01972fce-b879-7226-8c66-f0cb8e62a9aa) for the notes."
      }
    }
  ]
}
```

### Markdown document with a poll in the flow

The poll is a sibling block. It can be rendered between text paragraphs, moved
as a block, extracted by `pollUnitId`, and indexed through a projection.

```json
{
  "schema": "rezics/content-doc",
  "version": 1,
  "blocks": [
    {
      "kind": "text",
      "nodeId": "01972fd2-52d9-7aa4-8f27-c4c90fae1488",
      "text": {
        "kind": "markdown",
        "source": "Which edition should we read next?"
      }
    },
    {
      "kind": "poll",
      "nodeId": "01972fd2-74b6-7780-924f-6271b740003a",
      "pollUnitId": "01972fd3-1ff8-7ac2-998a-3a8b0f8fc275"
    },
    {
      "kind": "text",
      "nodeId": "01972fd2-9924-7959-a98b-63f793eb1744",
      "text": {
        "kind": "markdown",
        "source": "I will close the vote after the weekend."
      }
    }
  ]
}
```

### Plain text document

Plain text is supported by schema and projection. It is not the first editor
mode.

```json
{
  "schema": "rezics/content-doc",
  "version": 1,
  "blocks": [
    {
      "kind": "text",
      "nodeId": "01972fd2-a0df-70b7-b4da-b7cb8c7d00b1",
      "text": {
        "kind": "plainText",
        "source": "This source is plain text. Markdown markers stay literal."
      }
    }
  ]
}
```

### Structured text document

Structured text is the future rich-text representation. This proposal defines a
minimal schema shape and projection behavior, not a complete editor/rendering
surface.

```json
{
  "schema": "rezics/content-doc",
  "version": 1,
  "blocks": [
    {
      "kind": "text",
      "nodeId": "01972fd2-c11e-72b0-a1d3-430e8d8f7198",
      "text": {
        "kind": "structuredText",
        "nodes": [
          {
            "kind": "paragraph",
            "children": [
              { "kind": "text", "text": "Hello " },
              {
                "kind": "mention",
                "target": {
                  "kind": "user",
                  "userId": "01972fce-b879-7226-8c66-f0cb8e62a9aa"
                },
                "label": "@Alice"
              }
            ]
          }
        ]
      }
    }
  ]
}
```

### Unit reference block

This preserves the existing `unit-ref` use case but moves it into the flow and
changes the discriminant to `kind`.

```json
{
  "schema": "rezics/content-doc",
  "version": 1,
  "blocks": [
    {
      "kind": "unitRef",
      "nodeId": "01972fd2-da2f-7750-bc98-7cb6a2611d92",
      "unitId": "01972fdd-92c8-72a6-ad83-14be5ad0204a",
      "unitType": "BOOK"
    }
  ]
}
```

## Target TypeScript schema style

The exact line breaks can change during implementation, but the organization
should stay object-first: values, objects, unions, maps, types, then helpers.

```ts
export const CONTENT_DOC_SCHEMA = "rezics/content-doc" as const;
export const CONTENT_DOC_VERSION = 1 as const;

export const contentTextKindValues = [
  "markdown",
  "plainText",
  "structuredText",
] as const;

export const contentBlockKindValues = [
  "text",
  "poll",
  "unitRef",
] as const;

export const contentDocNodeIdSchema = t.String({ format: "uuid" });

export const markdownTextSchema = t.Object(
  {
    kind: t.Literal("markdown"),
    source: t.String(),
  },
  { additionalProperties: false },
);

export const plainTextSchema = t.Object(
  {
    kind: t.Literal("plainText"),
    source: t.String(),
  },
  { additionalProperties: false },
);

export const structuredTextNodeSchema = t.Recursive((Node) =>
  t.Union([
    t.Object(
      {
        kind: t.Literal("paragraph"),
        children: t.Array(Node),
      },
      { additionalProperties: false },
    ),
    t.Object(
      {
        kind: t.Literal("text"),
        text: t.String(),
        marks: t.Optional(t.Array(t.String())),
      },
      { additionalProperties: false },
    ),
    t.Object(
      {
        kind: t.Literal("mention"),
        target: t.Object(
          {
            kind: t.Literal("user"),
            userId: t.String({ format: "uuid" }),
          },
          { additionalProperties: false },
        ),
        label: t.String(),
      },
      { additionalProperties: false },
    ),
  ]),
);

export const structuredTextSchema = t.Object(
  {
    kind: t.Literal("structuredText"),
    nodes: t.Array(structuredTextNodeSchema),
  },
  { additionalProperties: false },
);

export const contentTextSchema = t.Union([
  markdownTextSchema,
  plainTextSchema,
  structuredTextSchema,
]);

export const contentDocBlockBaseSchema = t.Object(
  {
    nodeId: contentDocNodeIdSchema,
  },
  { additionalProperties: false },
);

export const textContentBlockSchema = t.Composite([
  contentDocBlockBaseSchema,
  t.Object(
    {
      kind: t.Literal("text"),
      text: contentTextSchema,
    },
    { additionalProperties: false },
  ),
]);

export const pollContentBlockSchema = t.Composite([
  contentDocBlockBaseSchema,
  t.Object(
    {
      kind: t.Literal("poll"),
      pollUnitId: t.String({ format: "uuid" }),
    },
    { additionalProperties: false },
  ),
]);

export const unitRefContentBlockSchema = t.Composite([
  contentDocBlockBaseSchema,
  t.Object(
    {
      kind: t.Literal("unitRef"),
      unitId: t.String({ format: "uuid" }),
      unitType: t.Optional(unitTypeSchema),
    },
    { additionalProperties: false },
  ),
]);

export const contentDocBlockSchema = t.Union([
  textContentBlockSchema,
  pollContentBlockSchema,
  unitRefContentBlockSchema,
]);

export const contentDocSchema = t.Object(
  {
    schema: t.Literal(CONTENT_DOC_SCHEMA),
    version: t.Literal(CONTENT_DOC_VERSION),
    blocks: t.Array(contentDocBlockSchema),
  },
  { additionalProperties: false },
);
```

Implementation note: if Elysia/TypeBox `t.Composite` creates awkward static
types for these exact objects, use local object helpers or inline full objects.
Do not introduce factory-function-shaped schemas as the primary expression.

## Helper API target

The helpers should make callsite intent explicit. This proposal intentionally
renames away from `mainMarkdownSource`.

```ts
export function markdownContentDoc(source: string): ContentDoc;

export function markdownTextBlock(input: {
  source: string;
  nodeId?: string;
}): TextContentBlock;

export function pollContentBlock(input: {
  pollUnitId: string;
  nodeId?: string;
}): PollContentBlock;

export function unitRefContentBlock(input: {
  unitId: string;
  unitType?: UnitType;
  nodeId?: string;
}): UnitRefContentBlock;

export function contentDocEditableMarkdownSource(
  value: unknown,
): string | null;

export function contentDocSearchMarkdownProjection(value: unknown): string;

export function extractPollUnitIdsFromContentDoc(value: unknown): string[];

export function extractUnitRefIdsFromContentDoc(value: unknown): string[];

export function extractMentionTargetsFromContentDoc(
  value: unknown,
): ContentDocMentionTarget[];
```

`contentDocEditableMarkdownSource()` returns a string only when the content doc
is safe to open in the current Markdown editor without losing structural blocks.
For example, a single markdown text block is editable; a document containing a
poll block is not silently flattened into one Markdown string. Product UI can
choose between a block-aware editor path, a read-only warning, or a temporary
Markdown-only creation path depending on the surface.

`contentDocSearchMarkdownProjection()` always returns a string. It is the search
and preview fallback path and is allowed to flatten non-Markdown blocks into a
readable projection.

## Markdown and mention design

Rezics Markdown should stay parser-based and library-backed. The editor and
renderer already use CodeMirror Markdown/GFM support and `markdown-it`; this
proposal extends that pipeline instead of inventing a Markdown implementation.

### Stored syntax

Use standard Markdown link syntax:

```md
[@Alice](rezics://user/01972fce-b879-7226-8c66-f0cb8e62a9aa)
```

Rules:

- The URL scheme `rezics://` means a Rezics internal semantic target.
- `rezics://user/<userId>` is the canonical user mention target.
- The link text must be a readable fallback, normally `@<displayName>`.
- The link text is not identity and not used for notification routing.
- Plain `@Alice` is only text.
- The notification pipeline uses extracted mention targets, not rendered HTML.

This solves the Markdown storage problem without custom syntax. Markdown can
store `userId` because links already have a destination field.

### Editor insertion

The current mention picker should stop inserting `@${name} `. It should insert:

```md
[@Alice](rezics://user/01972fce-b879-7226-8c66-f0cb8e62a9aa) 
```

The insert path must require a selected user option with `userId`. If search
does not return a stable ID, the option must not be insertable as a mention.

The autocomplete trigger can still be `@query`; only the resulting inserted
source changes.

### Rendering

The Markdown renderer should add a Rezics mention plugin/filter after normal
Markdown parsing:

- recognize `link_open` tokens whose `href` is `rezics://user/<uuid>`;
- mark the link with `data-rezics-mention-kind="user"` and
  `data-rezics-user-id="<uuid>"`;
- add a stable class hook such as `rezics-content-doc__mention`;
- resolve display data when a resolver is available;
- degrade to the original link label when display data is unavailable;
- prevent external navigation for unresolved internal semantic URIs.

This can be implemented inside the existing `createRezicsRenderer()` pipeline,
near `linkProtectionPlugin`, or as a separate plugin used by it. `classifyUrl`
must recognize `rezics://` as an internal Rezics URL class.

### Extraction

Mention extraction should parse Markdown into tokens and inspect link
destinations. It must not use a regex over raw `@` text.

Output shape:

```ts
export type ContentDocMentionTarget =
  | {
      kind: "user";
      userId: string;
      label?: string;
      nodeId?: string;
    };
```

The extractor can include the text block `nodeId` as context, but the durable
target is the `userId`.

## Search projection plan

Search sync should no longer ask for "main markdown". It should ask for the
content doc projection intended for indexing:

```ts
const contentText = contentDocSearchMarkdownProjection(row.content);
```

Projection rules:

- Markdown text block: append `source` unchanged.
- Plain text block: append `source` as text. Escaping is optional for search
  text, but deterministic output is required in tests.
- Structured paragraph/text: append text content; preserve paragraph breaks.
- Structured mention: append its `label` and a stable compact marker such as
  `[user:<userId>]` only if useful for diagnostics. Search relevance should
  primarily use the readable label.
- Poll block: append a deterministic placeholder such as
  `[poll:<pollUnitId>]`; if the sync layer has poll title/options available, it
  can enrich the indexed document outside the pure contract helper.
- Unit reference block: append `[unit:<unitId>]`; search sync may enrich labels
  separately when it has DB context.
- Unsupported structured node: append compact JSON so the payload is still
  discoverable and debugging does not lose information.
- Unknown or invalid value: return `""` or compact JSON only through an explicit
  invalid-value branch covered by tests.

Add a durable comment beside `contentDocSearchMarkdownProjection()`:

```ts
// Search indexes use a Markdown-like projection of all supported content-doc
// blocks. Unsupported structured nodes intentionally fall back to compact JSON:
// this keeps data searchable/debuggable while Markdown remains the only first
// editor surface.
```

## Implementation map

The cutover should be implemented in one coherent branch because the old helper
names are widespread.

### Contract

- Replace `package/contract/src/content/doc-v1.ts` and
  `package/contract/src/content/doc-v2.ts` with a single
  `package/contract/src/content/doc.ts`.
- Update `package/contract/src/content/index.ts` to export `./doc`.
- Delete `doc-v1.test.ts` and `doc-v2.test.ts`; add `doc.test.ts` for the new
  schema, factories, projections, and extractors.
- Keep helper names that still describe the new shape, such as
  `markdownContentDoc`, if their behavior is updated to emit `blocks[]`.
- Remove or replace `contentDocEnvelopeSchema` if it only exists to union old
  versions.

### Node ID generation

- Add one helper named `createSchemaNodeId()` or `createContentDocNodeId()`.
- Use the existing `uuid` package `v7()` in browser-capable code. Add the
  dependency only where the helper actually lives.
- Do not call `crypto.randomUUID()` for content block IDs because it produces
  UUIDv4 and loses the sortable UUIDv7 property Rezics already uses elsewhere.
- Do not introduce `nanoid`, `ulid`, or a custom ID format for this job.
- Factories accept optional `nodeId` only for tests/importers; normal app code
  should let the factory mint one.

### Editor and renderer

- Update `package/editor/src/markdown/mention/*` and
  `package/ui/src/editor/plugins/EditorMention.tsx` to insert Markdown links
  with `rezics://user/<userId>`.
- Update mention option types so selected mention options require stable
  identity before insertion.
- Add tests for trigger detection and inserted Markdown source.
- Add a renderer plugin for Rezics semantic links/mentions in the existing
  Markdown preview pipeline.
- Update `MarkdownContent`/content body renderers to preserve existing safe
  defaults and add stable class/data hooks for mentions.

### Server and notification

- Update post/comment/review/remark/chapter/draft write paths to emit
  `markdownContentDoc()` with the new shape.
- Update poll attachment paths so they append a `poll` block in `blocks[]`.
- Update post service logic that compares or extracts polls to use the new
  extractor.
- Add mention extraction to the write/update pipeline that creates mention
  notifications. Notification routing must use `userId`, not display text.
- Preserve current moderation/visibility rules around who receives
  notifications; this proposal only defines content extraction.

### Search

- Replace every search sync use of `mainMarkdownSource()` with
  `contentDocSearchMarkdownProjection()` or a domain-specific wrapper whose name
  says it is a search projection.
- Update search tests to include:
  - markdown text block;
  - markdown mention link;
  - poll block;
  - unit reference block;
  - plain text block;
  - structured text paragraph/mention;
  - unsupported structured node JSON fallback.
- Keep DB enrichment outside the pure contract helper. The helper should not
  query poll/unit/user titles.

### App callsites

- Replace editor initial-value reads with
  `contentDocEditableMarkdownSource()`.
- Surfaces that can include poll blocks must not silently flatten a document
  into Markdown for editing. They need either a block-aware composer path or a
  temporary guard that only opens Markdown-only content.
- Replace read-only previews with either the Markdown renderer for markdown text
  blocks plus explicit renderers for poll/unitRef blocks, or a higher-level
  `ContentDocRenderer`.
- Update story/test fixtures that import `doc-v1` directly.

### Convention checks

- Add or extend checks that reject new content-doc persisted discriminants named
  `type`.
- Add or extend checks that reject `_type`, `_key`, and `_id` inside canonical
  content-doc source files unless the file is an import/export adapter.
- Add a targeted check or test ensuring `content/index.ts` does not export old
  `doc-v1`/`doc-v2` modules after the cutover.

## Task checklist

- [ ] 1.1 Delete `package/contract/src/content/doc-v1.ts` and
  `package/contract/src/content/doc-v2.ts`.
- [ ] 1.2 Add `package/contract/src/content/doc.ts` with
  `CONTENT_DOC_SCHEMA = "rezics/content-doc"` and `CONTENT_DOC_VERSION = 1`.
- [ ] 1.3 Define `contentTextKindValues`,
  `contentBlockKindValues`, concrete text schemas, concrete block schemas, and
  the assembled `contentDocSchema`.
- [ ] 1.4 Update `package/contract/src/content/index.ts` to export only the new
  content-doc module.
- [ ] 1.5 Add `ContentDoc`, `ContentDocBlock`, text/block type aliases from the
  schema objects.
- [ ] 1.6 Implement `markdownContentDoc`, `markdownTextBlock`,
  `pollContentBlock`, and `unitRefContentBlock` helpers with optional `nodeId`
  override for tests/imports.
- [ ] 1.7 Add a single `createContentDocNodeId()` or `createSchemaNodeId()`
  helper wrapping `uuid` `v7()` where browser and server code can both use it.
- [ ] 1.8 Replace `mainMarkdownSource()` with
  `contentDocEditableMarkdownSource()` and
  `contentDocSearchMarkdownProjection()`.
- [ ] 1.9 Implement `extractPollUnitIdsFromContentDoc()` for `poll` blocks in
  `blocks[]`.
- [ ] 1.10 Implement `extractUnitRefIdsFromContentDoc()` for `unitRef` blocks in
  `blocks[]`.
- [ ] 1.11 Implement `extractMentionTargetsFromContentDoc()` for Markdown links
  and supported structured mention nodes.
- [ ] 1.12 Add the durable search projection comment beside
  `contentDocSearchMarkdownProjection()`.
- [ ] 2.1 Replace all `@rezics/contract` imports from `content/doc-v1` or
  `content/doc-v2` in tests and package internals.
- [ ] 2.2 Update app/editor/server/search callsites from `mainMarkdownSource()`
  to the appropriate new helper.
- [ ] 2.3 Update callsites of `markdownContentDocWithPoll()` to create a
  Markdown text block followed by a poll block.
- [ ] 2.4 Delete `markdownContentDocWithPoll()` unless a renamed helper such as
  `markdownContentDocWithBlocks()` is truly needed and object-shaped.
- [ ] 3.1 Update CodeMirror mention insertion to output
  `[@label](rezics://user/<userId>)`.
- [ ] 3.2 Update UI mention picker types so insertable mention options require
  `userId`.
- [ ] 3.3 Add mention insertion tests for user IDs, labels, and trailing-space
  behavior.
- [ ] 3.4 Extend `classifyUrl`/link handling to classify `rezics://` semantic
  links as internal Rezics links.
- [ ] 3.5 Add a Markdown renderer plugin/filter that marks user mention links
  with `rezics-content-doc__mention` and `data-rezics-*` attributes.
- [ ] 3.6 Add renderer tests for mention links, plain `@name`, blocked links,
  and normal external links.
- [ ] 4.1 Add `ContentDocRenderer` or equivalent block renderer for read-only
  content docs.
- [ ] 4.2 Render text blocks through the existing Markdown renderer when
  `text.kind === "markdown"`.
- [ ] 4.3 Render plain text blocks safely without Markdown parsing.
- [ ] 4.4 Render poll blocks through existing poll display components by
  `pollUnitId`.
- [ ] 4.5 Render unit reference blocks through existing unit card/chip
  components by `unitId`.
- [ ] 4.6 Treat `structuredText` rendering as a minimal fallback/projection
  unless a separate structured renderer plan is approved.
- [ ] 5.1 Update post/comment/review/remark/chapter/draft write paths to emit
  the new content-doc shape.
- [ ] 5.2 Update poll attachment services and composers so poll blocks are
  inserted into `blocks[]`.
- [ ] 5.3 Update post service poll comparison logic to use the new extractor.
- [ ] 5.4 Wire mention extraction into the notification pipeline with stable
  `userId` targets.
- [ ] 5.5 Add service tests for adding/removing polls and mentions during
  content edits.
- [ ] 6.1 Replace search sync description/content projection with
  `contentDocSearchMarkdownProjection()`.
- [ ] 6.2 Add search tests for markdown, plain text, structured text, poll,
  unit reference, mention, unsupported structured fallback, and invalid input.
- [ ] 6.3 Ensure Meilisearch document fields continue receiving deterministic
  `contentText`/`descriptionText` strings.
- [ ] 7.1 Update app read-only content previews to use block-aware rendering or
  explicit projection by intent.
- [ ] 7.2 Update app edit pages to use `contentDocEditableMarkdownSource()` and
  block editing guards where content is not Markdown-only.
- [ ] 7.3 Update Storybook/mock/factory data to emit the new DB JSON examples.
- [ ] 7.4 Update `package/server/src/content-doc/json-write.ts` to emit the new
  shape or delete it if it becomes redundant.
- [ ] 8.1 Add convention checks for content-doc `kind`/`nodeId` naming and no
  canonical `_type`/`_key`/`_id`.
- [ ] 8.2 Run focused contract/editor/search/server tests for touched packages.
- [ ] 8.3 Run `task check:convention` and the relevant package type checks.

## Out of scope

- Backward-compatible upgrade chains for existing `doc-v1` or draft `doc-v2`
  JSON.
- A full structured-text editor, renderer, diff algorithm, or collaborative
  editing model.
- Storing Portable Text directly in Rezics DB JSON.
- Custom Markdown syntax for polls or mentions.
- HTML-as-source persistence.
- Search-time DB enrichment for poll titles, unit labels, or user names inside
  the pure contract projection helper.
