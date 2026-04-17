# @rezics/folio

Ebook reader component for React. Provides a rich reading experience with pagination, gesture navigation, theming, and a plugin system for multiple file formats.

## Overview

A self-contained reader component designed for the Rezics platform. Supports both page-based and scroll-based reading modes, touch gestures, keyboard navigation, and a table of contents panel. File format support is extensible via plugins.

## Exports

| Entry Point        | Description                                    |
| ------------------ | ---------------------------------------------- |
| `.`                | Core: `Folio`, `FolioProvider`, `useFolio`, types |
| `./plugin/txt`     | Plain text file plugin                         |
| `./plugin/epub`    | EPUB file plugin                               |

## Usage

```typescript
import { Folio, FolioProvider } from '@rezics/folio';
import { epubPlugin } from '@rezics/folio/plugins/epub';

function Reader({ file }: { file: File }) {
  return (
    <FolioProvider>
      <Folio plugin={epubPlugin} source={file} />
    </FolioProvider>
  );
}
```

## Features

- **Reading Modes** — Page-based pagination and continuous scroll
- **Gestures** — Swipe and tap navigation via `@use-gesture/react`
- **Keyboard Navigation** — Arrow keys, Page Up/Down support
- **Table of Contents** — Sidebar panel for chapter navigation
- **Theming** — Customizable reading theme (colors, font size, line height)
- **Progress Tracking** — Reading position and progress state
- **Plugin System** — Extensible format support via `PluginRegistry`

## Plugins

| Plugin | Format | Description                                   |
| ------ | ------ | --------------------------------------------- |
| `txt`  | `.txt` | Plain text rendering                          |
| `epub` | `.epub`| EPUB parsing (ZIP + XML) with chapter tree    |

## Tech Stack

- [React 18+](https://react.dev) with context-based state
- [@use-gesture/react](https://use-gesture.netlify.app) for touch/pointer gestures
- [fflate](https://github.com/101arrowz/fflate) for ZIP decompression (EPUB)
- [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) for EPUB structure parsing
- [React Cosmos](https://reactcosmos.org) for component development
