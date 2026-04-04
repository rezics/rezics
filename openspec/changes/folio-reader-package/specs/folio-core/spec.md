## ADDED Requirements

### Requirement: Package scaffold

The `package/folio` directory SHALL contain a valid Bun workspace package with `package.json` (name: `@rezics/folio`), `tsconfig.json` extending the monorepo base, and `src/index.ts` as the main entry point. The package SHALL declare `@use-gesture/react` as a dependency and `react`, `react-dom`, `@rezics/editor` as peer dependencies.

#### Scenario: Package resolves in workspace
- **WHEN** a consumer package adds `"@rezics/folio": "workspace:*"` to its dependencies
- **THEN** Bun resolves the package and its exports without error

### Requirement: FolioNode tree type

The system SHALL export a `FolioNode` interface representing a tree node with `id: string`, `title: string`, optional `children: FolioNode[]` (branch nodes), and optional `fetch: (signal: AbortSignal) => Promise<FolioContent>` (leaf nodes). A node with `fetch` is a readable chapter. A node with `children` is a structural grouping.

#### Scenario: Backend-sourced chapter tree
- **WHEN** a consumer maps `ChapterTreeItem[]` from the Rezics API to `FolioNode[]`, wiring `fetch` to API calls on leaf nodes
- **THEN** each leaf node's `fetch()` returns a `Promise<FolioContent>` with `contentType` and `raw` fields

#### Scenario: Branch node without content
- **WHEN** a `FolioNode` has `children` but no `fetch`
- **THEN** the node is treated as a structural grouping (part/section) and is not navigable as a chapter

### Requirement: FolioContent type

The system SHALL export a `FolioContent` interface with `contentType: string` (e.g., `'txt'`, `'html'`, `'markdown'`), `raw: string` (the full chapter text), and optional `meta: Record<string, unknown>` for plugin-specific metadata.

#### Scenario: Content type used for renderer resolution
- **WHEN** a leaf node's `fetch()` resolves with `{ contentType: 'txt', raw: '...' }`
- **THEN** the plugin registry resolves the renderer registered for `'txt'` content type

### Requirement: FolioState type

The system SHALL maintain state via `FolioState` containing: `readMode: 'scroll' | 'page'`, `chapterIndex: number`, `pageIndex: number`, `pageCount: number`, `scrollOffset: number`, `fontSize: number`, `lineHeight: number`, `theme: 'light' | 'dark' | 'sepia'`, `turnStyle: 'rotate' | 'slide' | 'fade'`, and `status: FolioStatus`.

#### Scenario: Initial state defaults
- **WHEN** `<Folio />` mounts without explicit state overrides
- **THEN** the initial state uses `readMode: 'page'`, `theme: 'light'`, `turnStyle: 'rotate'`, `fontSize: 16`, `lineHeight: 1.6`

### Requirement: FolioStatus type

The system SHALL track loading status as a discriminated union: `{ state: 'idle' }`, `{ state: 'loading', chapterIndex?: number }`, `{ state: 'ready' }`, or `{ state: 'error', error: Error, retry: () => void }`.

#### Scenario: Loading state during chapter fetch
- **WHEN** a chapter's `fetch()` is in-flight
- **THEN** `status` is `{ state: 'loading', chapterIndex: <index> }`

#### Scenario: Error state with retry
- **WHEN** a chapter's `fetch()` rejects
- **THEN** `status` is `{ state: 'error', error: <Error>, retry: <function> }` and calling `retry()` re-invokes the fetch

### Requirement: FolioDispatch action surface

The system SHALL expose a `FolioDispatch` function accepting a discriminated union of actions: `SET_READ_MODE`, `SET_CHAPTER`, `SET_PAGE`, `SET_FONT_SIZE`, `SET_LINE_HEIGHT`, `SET_THEME`, `SET_TURN_STYLE`. No generic `SET_STATE` action SHALL exist.

#### Scenario: Plugin dispatches theme change
- **WHEN** a plugin's Settings panel calls `dispatch({ type: 'SET_THEME', theme: 'sepia' })`
- **THEN** `FolioState.theme` updates to `'sepia'` and the content area re-renders with sepia styling

### Requirement: FolioContext provider and useFolio hook

The system SHALL provide a `<FolioProvider>` React context provider that holds `FolioState`, `FolioDispatch`, the flattened chapter list, and the plugin registry. A `useFolio()` hook SHALL return `{ state, dispatch, flatChapters, registry }`.

#### Scenario: Nested component accesses state
- **WHEN** a component inside `<FolioProvider>` calls `useFolio()`
- **THEN** it receives the current `FolioState`, dispatch function, flat chapter array, and plugin registry

#### Scenario: Hook outside provider throws
- **WHEN** `useFolio()` is called outside a `<FolioProvider>`
- **THEN** it throws a descriptive error

### Requirement: Plugin registry (renderer plugins only)

The system SHALL provide a `PluginRegistry` class with `register(...plugins: RendererPlugin[])`, `resolveRenderer(contentType: string): RendererPlugin | undefined`, and `collectSlot(slot: 'Toolbar' | 'Controls' | 'Settings'): React.ComponentType<PanelProps>[]`.

#### Scenario: Renderer resolution by content type
- **WHEN** `resolveRenderer('txt')` is called and a plugin registered with `contentTypes: ['txt']` exists
- **THEN** that plugin is returned

#### Scenario: No matching renderer
- **WHEN** `resolveRenderer('unknown')` is called and no plugin handles that content type
- **THEN** `undefined` is returned and the content area displays a fallback message

### Requirement: RendererPlugin interface

Each renderer plugin SHALL declare `kind: 'renderer'`, `id: string`, `contentTypes: string[]`, a `Renderer` React component, and optional `Toolbar`, `Controls`, `Settings` panel components. The `kind` field SHALL be used for type discrimination.

#### Scenario: Plugin with Settings panel
- **WHEN** a renderer plugin provides a `Settings` component
- **THEN** `collectSlot('Settings')` includes that component in its result array

### Requirement: Folio component props

The `<Folio />` component SHALL accept: `tree: FolioNode[]`, `plugins: RendererPlugin[]`, `initialPosition?: FolioPosition`, `onProgressChange?: (progress: FolioProgress) => void`, `onTreeChange?: (tree: FolioNode[]) => void`, `renderLoading?: () => ReactNode`, `renderError?: (error: Error, retry: () => void) => ReactNode`, and `config?: FolioConfig`.

#### Scenario: Consumer provides all props
- **WHEN** `<Folio tree={nodes} plugins={[txtPlugin]} initialPosition={{ chapterIndex: 5 }} onProgressChange={save} />` is rendered
- **THEN** folio initializes at chapter 5, renders using the txt plugin, and calls `save()` on navigation

### Requirement: FolioConfig options

The system SHALL accept a `FolioConfig` with `prefetchThreshold: number` (default: 2). This controls how many pages before the end of a chapter folio begins prefetching the next chapter.

#### Scenario: Prefetch triggers at threshold
- **WHEN** the user is within `prefetchThreshold` pages of the last page of a chapter
- **THEN** folio begins fetching the next chapter's content via its `fetch()` method
