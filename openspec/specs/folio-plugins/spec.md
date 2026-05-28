# folio-plugins Specification

## Purpose

Owns the renderer plugins that ship with the folio reader: the
`.epub` plugin (a DIY parser built on fflate + fast-xml-parser
that walks `container.xml` to the OPF, builds manifest/spine
reading order, extracts chapter HTML, rewrites internal assets
to blob URLs with lifecycle cleanup, derives the `FolioNode`
tree from NCX or EPUB 3 nav, and contributes a TOC Controls
panel with partial-loading semantics), and the plain-text plugin
(the `splitTxt` rule-based chapter splitter with default CJK,
English, markdown, and ASCII-divider rules, in-memory leaf
`fetch`, `createRezicsRenderer` integration that preserves
novel-mode whitespace, and a Settings panel that exposes
editable regex rules, a regex test/preview, and a re-split
callback that publishes a fresh chapter tree via `onTreeChange`).

## EPUB plugin

### Requirement: Epub parser (DIY, no epubjs)

The epub plugin SHALL implement its own epub parser using `fflate` for ZIP extraction and `fast-xml-parser` for XML parsing. It SHALL NOT depend on `epubjs` or any epub rendering library.

#### Scenario: Parse a valid epub file
- **WHEN** `createEpubPlugin(file)` is called with a valid `.epub` File
- **THEN** the parser extracts the OPF manifest, spine reading order, and NCX/nav TOC without error

### Requirement: OPF manifest and spine parsing

The parser SHALL: (1) read `META-INF/container.xml` to locate the OPF file path, (2) parse the OPF `<manifest>` to build an item-id-to-href map, (3) parse the OPF `<spine>` to determine reading order as a sequence of manifest item references.

#### Scenario: Locate OPF via container.xml
- **WHEN** the epub's `META-INF/container.xml` contains `<rootfile full-path="OEBPS/content.opf" />`
- **THEN** the parser reads and parses `OEBPS/content.opf`

#### Scenario: Spine reading order
- **WHEN** the spine contains `<itemref idref="ch1" />`, `<itemref idref="ch2" />`, `<itemref idref="ch3" />`
- **THEN** the parser resolves these to the corresponding manifest hrefs in spine order

### Requirement: Chapter HTML extraction

Each spine item SHALL be extracted as raw HTML from the epub ZIP. The result is a `FolioContent` with `contentType: 'html'` and `raw` containing the sanitized XHTML content.

#### Scenario: Spine item to FolioContent
- **WHEN** spine item `ch1` resolves to `OEBPS/chapter1.xhtml`
- **THEN** the file is read from the ZIP and its content is returned as `{ contentType: 'html', raw: '<html>...' }`

### Requirement: Internal asset resolution to blob URLs

The parser SHALL resolve relative asset references (images, fonts) within chapter HTML to blob URLs. For each referenced asset found in the epub ZIP, the parser SHALL create a blob URL and rewrite the HTML `src`/`href` attributes.

#### Scenario: Image resolution
- **WHEN** chapter HTML contains `<img src="../images/cover.jpg" />`
- **THEN** the parser reads `images/cover.jpg` from the ZIP, creates a blob URL, and replaces the `src` with the blob URL

#### Scenario: Asset not found in ZIP
- **WHEN** chapter HTML references an asset that doesn't exist in the ZIP
- **THEN** the reference is left unchanged (graceful degradation)

### Requirement: Blob URL lifecycle management

All blob URLs created during epub parsing SHALL be revoked when the epub plugin is unmounted or when the tree changes. The plugin SHALL track all created blob URLs and call `URL.revokeObjectURL()` on cleanup.

#### Scenario: Cleanup on unmount
- **WHEN** the `<Folio />` component unmounts
- **THEN** all blob URLs created by the epub plugin are revoked

### Requirement: TOC extraction from NCX or nav document

The parser SHALL extract the table of contents from the epub's NCX (`toc.ncx`) or EPUB 3 nav document. The TOC entries SHALL map to `FolioNode` branch/leaf structure, preserving the hierarchy.

#### Scenario: Hierarchical TOC
- **WHEN** the NCX has `Part 1 > [Chapter 1, Chapter 2]` and `Part 2 > [Chapter 3]`
- **THEN** the resulting `FolioNode[]` tree reflects this hierarchy with branch and leaf nodes

#### Scenario: Flat TOC
- **WHEN** the NCX has no nesting (all entries at the same level)
- **THEN** the resulting `FolioNode[]` is a flat array of leaf nodes

### Requirement: createEpubPlugin factory

The plugin SHALL export `createEpubPlugin(file: File): Promise<{ plugin: RendererPlugin, tree: FolioNode[] }>`. This parses the epub, builds the chapter tree with fetch methods returning pre-extracted HTML, and returns a plugin instance with a Controls panel for TOC navigation.

#### Scenario: Consumer setup
- **WHEN** a consumer calls `const { plugin, tree } = await createEpubPlugin(epubFile)`
- **THEN** it receives a plugin and tree ready to pass to `<Folio />`

### Requirement: Controls panel with TOC navigation

The epub plugin SHALL contribute a `Controls` panel component displaying the TOC extracted from the epub. Tapping a TOC entry navigates to the corresponding chapter.

#### Scenario: TOC navigation
- **WHEN** the user taps "Chapter 5" in the epub Controls panel
- **THEN** the reader navigates to the `chapterIndex` corresponding to Chapter 5

### Requirement: Partial loading on parse error

If some spine items fail to parse while others succeed, the parser SHALL return the successful chapters and include warnings in `meta`. It SHALL NOT reject the entire promise for partial failures.

#### Scenario: Partial epub parse
- **WHEN** 8 of 10 spine items parse successfully and 2 fail
- **THEN** the returned tree contains 8 leaf nodes, and each successful node's `meta` does not contain warnings, while the overall result includes a `warnings` array identifying the failed items

## TXT plugin

### Requirement: Txt tree builder utility

The txt plugin SHALL export a `splitTxt(raw: string, options?: TxtSplitOptions): TxtSplitResult` function. It tries each regex rule in order against the raw text, uses the first rule that produces >= 2 chunks, and returns a `FolioNode[]` tree and the matched rule. If no rule produces >= 2 chunks, the entire text becomes a single chapter.

#### Scenario: CJK chapter markers
- **WHEN** `splitTxt()` is called on text containing lines starting with `第一章`, `第二章`, etc.
- **THEN** the default rule `/^第[零一二三四五六七八九十百千万\d]+[章节回]/m` matches, producing one `FolioNode` per chapter with the chapter marker line as the title

#### Scenario: English chapter markers
- **WHEN** text contains `Chapter 1`, `Chapter 2` lines but no CJK markers
- **THEN** the CJK rule fails (< 2 matches), the English rule `/^Chapter\s+\d+/im` matches

#### Scenario: No rule matches
- **WHEN** the text has no recognizable chapter markers
- **THEN** a single `FolioNode` with title `"Full Text"` is returned containing the entire text

#### Scenario: Custom rules
- **WHEN** `splitTxt(raw, { splitRules: [/^Part\s+\w+/im] })` is called
- **THEN** only the custom rules are tried (default rules are replaced)

### Requirement: Default split rules

The default split rules SHALL be tried in this order:
1. `/^第[零一二三四五六七八九十百千万\d]+[章节回]/m` — CJK chapter markers
2. `/^Chapter\s+\d+/im` — English chapter markers
3. `/^#{1,3}\s+/m` — Markdown headings
4. `/^={3,}/m` — `===` dividers
5. `/^-{3,}/m` — `---` dividers

#### Scenario: Rule priority
- **WHEN** text contains both CJK chapter markers and `---` dividers
- **THEN** the CJK rule is used because it appears earlier in the list and produces >= 2 chunks

### Requirement: Leaf fetch returns content synchronously

Each `FolioNode` produced by `splitTxt()` SHALL have a `fetch()` that returns `Promise.resolve({ contentType: 'txt', raw: <chunk> })`. Since the text is already in memory, no async I/O occurs.

#### Scenario: Immediate content availability
- **WHEN** a consumer calls `fetch()` on a txt-split leaf node
- **THEN** the promise resolves synchronously (microtask) with the chunk content

### Requirement: Txt renderer plugin

The txt plugin SHALL register a renderer for `contentTypes: ['txt']`. The renderer SHALL use `createRezicsRenderer()` from `@rezics/editor/markdown` to render the text with novel mode (line break preservation, empty line preservation, space preservation). The output SHALL be themed according to the current `FolioState` (fontSize, lineHeight, theme).

#### Scenario: Plain text rendering
- **WHEN** content with `contentType: 'txt'` is rendered
- **THEN** the text appears with preserved line breaks, deliberate spacing, and reader theme styling

#### Scenario: Theme application
- **WHEN** the reader theme is `'sepia'`
- **THEN** the txt renderer applies sepia background and dark text colors

### Requirement: createTxtPlugin factory

The plugin SHALL export `createTxtPlugin(raw: string, options?: TxtSplitOptions): { plugin: RendererPlugin, tree: FolioNode[] }`. This creates a plugin instance (renderer + Settings UI) and the initial chapter tree in one call. The plugin instance retains a reference to the original raw text for re-splitting.

#### Scenario: Consumer setup
- **WHEN** a consumer calls `createTxtPlugin(rawText)`
- **THEN** it receives a `plugin` to pass to `<Folio plugins={[plugin]} />` and a `tree` to pass to `<Folio tree={tree} />`

### Requirement: Settings panel with regex configuration

The txt plugin SHALL contribute a `Settings` panel component. The panel SHALL display the current list of split rules as editable regex strings. The user SHALL be able to:
- Remove a rule from the list
- Add a new rule
- Reorder rules (drag or move up/down)

#### Scenario: Remove a rule
- **WHEN** the user removes the second rule from the list
- **THEN** the rule list updates to exclude that rule, but the tree does not change until re-split is triggered

#### Scenario: Add a new rule
- **WHEN** the user enters `/^Part\s+\w+/im` and taps "Add to Rules"
- **THEN** the rule is appended to the rule list

### Requirement: Regex test and preview

The Settings panel SHALL provide a test input where the user can enter a regex pattern and preview its effect before adding it. The preview SHALL show: the number of matches found and the first few matched lines from the original text.

#### Scenario: Test a regex
- **WHEN** the user enters `/^Part\s+\w+/im` in the test input and taps "Preview"
- **THEN** the UI shows "3 matches found" and lists the first few matching lines

#### Scenario: Invalid regex
- **WHEN** the user enters an invalid regex pattern (e.g., `/[invalid/`)
- **THEN** the UI shows a syntax error message and the "Add to Rules" button is disabled

### Requirement: Re-split with tree change callback

The Settings panel SHALL provide a "Re-split" button. When pressed, it re-runs `splitTxt()` with the current rule list and calls `requestTreeChange(newTree)` via `PanelProps`. The consumer's `onTreeChange` callback fires with the new tree. Reading position resets to chapter 0.

#### Scenario: Re-split produces new tree
- **WHEN** the user changes rules and taps "Re-split"
- **THEN** `requestTreeChange()` is called with a new `FolioNode[]` tree, and the reader resets to chapter 0

#### Scenario: Re-split result display
- **WHEN** re-split completes
- **THEN** the Settings panel shows the updated chapter count and which rule was used (or "single chapter" if no rule matched)
