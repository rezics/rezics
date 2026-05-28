# folio-plugin-epub Specification

## Purpose

Defines the folio renderer plugin for `.epub` files: a DIY parser
(fflate + fast-xml-parser, no `epubjs`) that locates the OPF via
`container.xml`, builds the manifest/spine reading order, extracts
chapter HTML, rewrites internal asset references to blob URLs (with
lifecycle cleanup), and constructs the `FolioNode` tree from the NCX
or EPUB 3 nav document. Also owns the `createEpubPlugin` factory,
the Controls panel for TOC navigation, and the partial-loading
contract when individual spine items fail to parse.

## Requirements

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
