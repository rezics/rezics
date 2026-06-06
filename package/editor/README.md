# @rezics/editor

Rich text editor library built on [CodeMirror 6](https://codemirror.net) with React integration. Supports Markdown and JSON editing with syntax highlighting, autocompletion, and extensible plugins.

## Overview

A modular editor library designed for the Rezics platform. It provides both granular building blocks and pre-configured presets for Markdown and JSON editing, along with React components and hooks for easy integration.

## Exports

The package exposes multiple entry points for granular imports:

| Entry Point   | Description                                     |
| ------------- | ----------------------------------------------- |
| `.`           | Core editor creation, themes, and types         |
| `./markdown`  | Full Markdown editor preset (emoji, mentions)   |
| `./json`      | Full JSON editor preset (validation, linting)   |
| `./editor`    | React `Editor` component and `useEditor` hook   |

## Usage

### React Integration

```typescript
import { Editor, useEditor } from '@rezics/editor/editor';
import { markdownFull } from '@rezics/editor/markdown';

function MarkdownEditor() {
  const { editorRef } = useEditor({
    plugins: [markdownFull()],
  });

  return <Editor ref={editorRef} />;
}
```

### Core API

```typescript
import { createEditor, createTheme } from '@rezics/editor';
import { markdown } from '@rezics/editor';

const editor = createEditor({
  parent: element,
  plugins: [markdown()],
});
```

## Modules

### Markdown

- Full Markdown language support with syntax highlighting
- Emoji picker and inline emoji completion
- @mention autocompletion
- Toolbar utilities for formatting actions

### JSON

- JSON language support with syntax highlighting
- Schema-based linting and validation
- Error reporting

### Core

- `createEditor` — Factory for creating editor instances
- `createTheme` — Theme configuration for editor styling
- Plugin architecture for extensibility

## Tech Stack

- [CodeMirror 6](https://codemirror.net) for the editor engine
- [Lezer](https://lezer.codemirror.net) for incremental parsing
- [markdown-it](https://github.com/markdown-it/markdown-it) for Markdown rendering
- [highlight.js](https://highlightjs.org) for syntax highlighting
- [React Cosmos](https://reactcosmos.org) for component development
