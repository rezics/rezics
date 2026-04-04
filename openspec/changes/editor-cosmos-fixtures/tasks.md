## 1. Shared Stubs

- [x] 1.1 Create `src/editor/markdown/_stubs.ts` with minimal `MentionConfig` stub (3-5 hardcoded items, trigger character) and `EmojiConfig` stub

## 2. Markdown Fixtures

- [x] 2.1 Create `src/editor/markdown/MarkdownEditor.fixture.tsx` with named fixtures: `Default` (preview=false), `WithPreview` (preview=true), `LongContent`, `EmptyContent`
- [x] 2.2 Create `src/editor/markdown/MarkdownPreview.fixture.tsx` with: `ViewModes` (interactive useFixtureSelect for write/preview/dual), `Fullscreen`, `NoHighlight` (highlight=false), `NovelFormatting` (content with extra blanks/spaces), `CodeBlocks` (multi-language fenced blocks)
- [x] 2.3 Create `src/editor/markdown/MarkdownToolbar.fixture.tsx` with: `DefaultToolbar`, `NoToolbar` (toolbar=false), `CustomIcons`, `ExtendedToolbar` (extend function), `WithPreviewButtons` (preview=true), `WithoutPreviewButtons` (preview=false)
- [x] 2.4 Create `src/editor/markdown/MarkdownPlugins.fixture.tsx` with: `WithMention` (using stub), `WithEmoji` (using stub), `AllPlugins` (mention+emoji+preview)

## 3. JSON Fixtures

- [x] 3.1 Create `src/editor/json/JsonEditor.fixture.tsx` with named fixtures: `Default` (valid JSON), `WithLintErrors` (malformed JSON), `NoLint` (lint=false), `LargeDocument`
- [x] 3.2 Create `src/editor/json/JsonToolbar.fixture.tsx` with: `DefaultToolbar`, `CustomFormatIcon`, `NoToolbar` (toolbar=false)

## 4. Code Editor Fixtures

- [x] 4.1 Create `src/editor/code/CodeEditor.fixture.tsx` with named fixtures: `Default` (plain text), `WithCustomPlugin` (consumer plugin with toolbar item to show it's suppressed)

## 5. Theme Fixtures

- [x] 5.1 Create `src/editor/theme/EditorTheme.fixture.tsx` with: `ThemeVariants` (interactive useFixtureSelect for light/dark), `CustomColors` (custom background/foreground/caret/selection), `CustomSyntaxStyles` (TagStyle rules), `DarkMarkdownWithPreview` (dark theme + markdown preview=true), `LightJsonWithLint` (light theme + invalid JSON)

## 6. Cleanup and Verification

- [x] 6.1 Delete old flat fixtures: `src/editor/MarkdownEditor.fixture.tsx`, `src/editor/JsonEditor.fixture.tsx`, `src/editor/CodeEditor.fixture.tsx`
- [x] 6.2 Verify `src/editor/EditorOptions.fixture.tsx` remains unchanged
- [x] 6.3 Run `bun run cosmos` in `package/editor` and verify all fixtures appear in the sidebar under the correct folder hierarchy
