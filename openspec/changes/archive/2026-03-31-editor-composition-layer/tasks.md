## 1. Setup

- [x] 1.1 Create `src/editor/` directory in `package/editor`
- [x] 1.2 Add `lucide-react` as a dependency in `package/editor/package.json`
- [x] 1.3 Add `"./editor": "./src/editor/index.ts"` to the `exports` field in `package/editor/package.json`
- [x] 1.4 Run `bun install` to resolve the new dependency

## 2. Toolbar Types and Utilities

- [x] 2.1 Create `src/editor/types.ts` with `ToolbarOverride`, `BaseEditorProps`, `MarkdownEditorProps`, `JsonEditorProps`, `CodeEditorProps` types
- [x] 2.2 Create `src/editor/toolbar-defaults.tsx` with `markdownIconMap` and `jsonIconMap` mapping toolbar item names to lucide-react icon elements
- [x] 2.3 Create `src/editor/toolbar-utils.ts` with `applyIconDefaults(items, iconMap)` and `applyToolbarOverrides(items, override)` functions; `applyIconDefaults` sets `item.icon` from the icon map when not already set; `applyToolbarOverrides` applies `icons` → `extend` pipeline in order
- [x] 2.4 Write tests for toolbar-utils: verify icon defaults are applied, consumer icon overrides take precedence, extend callback transforms items correctly

## 3. Composed Editor Components

- [x] 3.1 Create `src/editor/MarkdownEditor.tsx`: call `markdownFull()` with props (`preview` defaults to `true`, optional `mention`, `emoji`); apply `markdownIconMap` icon defaults; process `toolbar` override prop; if `toolbar.render` is provided, render custom toolbar via `EditorContext.Provider` wrapping; otherwise pass `toolbar="react"` to `<Editor>`; append consumer `plugins` and `keybindings`; forward `value`, `onChange`, `theme`, `className`
- [x] 3.2 Create `src/editor/MarkdownEditor.test.tsx`: test that component renders without error; test that default plugins include markdown language support; test that toolbar override `icons` replaces the correct item; test that `toolbar={false}` suppresses toolbar; test that `plugins` prop appends to defaults
- [x] 3.3 Create `src/editor/JsonEditor.tsx`: call `jsonFull()` with `lint` prop (defaults `true`); apply `jsonIconMap` icon defaults; process `toolbar` override prop (same pattern as MarkdownEditor); forward common props to `<Editor>`
- [x] 3.4 Create `src/editor/JsonEditor.test.tsx`: test rendering; test format button has icon; test `lint={false}` disables linting plugin; test toolbar override
- [x] 3.5 Create `src/editor/CodeEditor.tsx`: render `<Editor>` with no plugins and `toolbar={false}`; forward `value`, `onChange`, `theme`, `className`, `keybindings`, consumer `plugins`
- [x] 3.6 Create `src/editor/CodeEditor.test.tsx`: test rendering with no plugins; test that consumer `plugins` are forwarded

## 4. Barrel Export

- [x] 4.1 Create `src/editor/index.ts` re-exporting `MarkdownEditor`, `JsonEditor`, `CodeEditor`, their prop types, and `ToolbarOverride` type

## 5. Fixture Migration

- [x] 5.1 Move `src/react/MarkdownEditor.fixture.tsx` to `src/editor/MarkdownEditor.fixture.tsx`; rewrite to use `<MarkdownEditor>` component instead of manual `<Editor plugins={...}>` wiring
- [x] 5.2 Move `src/react/JsonEditor.fixture.tsx` to `src/editor/JsonEditor.fixture.tsx`; rewrite to use `<JsonEditor>` component
- [x] 5.3 Move `src/react/CodeEditor.fixture.tsx` to `src/editor/CodeEditor.fixture.tsx`; rewrite to use `<CodeEditor>` component
- [x] 5.4 Move `src/react/EditorOptions.fixture.tsx` to `src/editor/EditorOptions.fixture.tsx`; rewrite to use composed editor components with a mode selector
- [x] 5.5 Verify `cosmos.config.json` fixture glob patterns still discover `src/editor/*.fixture.tsx`

## 6. Validation

- [x] 6.1 Run `bun test` in `package/editor` — all tests pass
- [x] 6.2 Run TypeScript type-check (verify no type errors in new files)
- [x] 6.3 Verify `import { MarkdownEditor, JsonEditor, CodeEditor } from '@rezics/editor/editor'` resolves from a consuming package
- [ ] 6.4 Run `bun run cosmos` and verify all migrated fixtures render correctly with icons and toolbar overrides
