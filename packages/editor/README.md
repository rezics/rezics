# `@rezics/editor`

Reusable, loss-aware editor capabilities for REZICS products.

The package deliberately separates its entry points so consumers can load only the capability they need:

```ts
import {CodeEditor} from '@rezics/editor/codemirror'
import {
  convertRezicsMarkdownDocument,
  markdownToRezicsPortableText,
  rezicsMarkdown,
  rezicsMarkdownDialect,
  rezicsMarkdownLivePreview,
  rezicsMarkdownSchemaDefinition,
} from '@rezics/editor/markdown'
import {PortableTextEditor} from '@rezics/editor/portable-text'
```

## REZICS Markdown

`rezics-markdown@1` is a frozen dialect contract. It currently covers the documented CommonMark/GFM baseline and has no project-specific token extensions. The name and version exist now so future REZICS syntax can evolve through explicit migrations instead of silently following parser upgrades.

Markdown and Portable Text conversions return typed diagnostics. Unsupported or invalid input never produces a silently truncated document.

The rich-text profile deliberately blocks Markdown structures that its editable Portable Text shape cannot preserve, including a leading UTF-8 byte-order mark, soft line breaks, non-`1` ordered-list starts, loose or multi-block list items, mixed task/ordinary lists, separated adjacent or structural/nested block quotes, and GitHub alert blocks. Source mode still edits those documents normally; an application must keep source authority when the conversion reports an error. Portable Text serialization passes through a project-owned MDAST bridge and Portable Text mark tree so literal Markdown punctuation, nested decorators, code delimiters, image alternative text, GFM tables, and link destinations are escaped without changing their meaning.

## Editing modes

CodeMirror is the source editor. `rezicsMarkdownLivePreview` adds a source-backed live preview: inactive delimiters are decorated out of view, while the real Markdown characters are revealed wherever the selection is active. Reconfiguring that extension keeps the same CodeMirror document, selection, and history.

Portable Text conversion remains an explicit interoperability boundary. `convertRezicsMarkdownDocument` can hand authority to a structured document when another product genuinely needs that model; applications should not run bidirectional conversion on every keystroke or use a structured projection as the authority for Markdown source editing.

## Maturity

The package starts at the repository's first supported `1.0.0` baseline. Exported APIs are currently marked `@alpha` while the first product integration settles their shape.
