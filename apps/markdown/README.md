# `@rezics/markdown-editor`

The independent local Markdown editor product. It consumes `@rezics/editor` but does not own or constrain the reusable editor package.

## Workspaces

- `@rezics/markdown-editor-app` contains environment-neutral product state and React UI.
- `@rezics/markdown-editor-web` is a Vite host that runs as a standalone browser service and is also the Tauri WebView frontend.
- `src-tauri` is the narrow native filesystem boundary.

## Development

```sh
task apps-markdown:dev:web
task apps-markdown:dev
```

The Web service uses browser file APIs with import/download fallbacks. The desktop build uses native dialogs, opaque file IDs, fingerprint conflict detection, UTF-8 and size validation, and atomic writes.

Source and Live preview are two presentations of one CodeMirror document. Live preview styles parsed Markdown and hides inactive delimiters, then reveals the real source characters at the active selection so edits, selection, and undo history remain literal Markdown operations.

## Verification and release builds

```sh
task apps-markdown:check
task apps-markdown:test
task apps-markdown:build:web
task apps-markdown:build
```

The desktop build delegates to a cross-platform Node entry point. On Linux it disables linuxdeploy's secondary strip pass so AppImage packaging also works on distributions whose ELF files use modern `SHT_RELR` sections; Cargo still produces an optimized release binary.
