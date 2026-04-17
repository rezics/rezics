## ADDED Requirements

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
