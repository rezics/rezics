import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';

const markdownHighlightStyle = HighlightStyle.define([
  // Headings
  { tag: tags.heading1, fontSize: '1.6em', fontWeight: 'bold', color: '#1a1a1a' },
  { tag: tags.heading2, fontSize: '1.4em', fontWeight: 'bold', color: '#1a1a1a' },
  { tag: tags.heading3, fontSize: '1.2em', fontWeight: 'bold', color: '#1a1a1a' },
  { tag: tags.heading4, fontSize: '1.1em', fontWeight: 'bold' },
  { tag: tags.heading5, fontSize: '1.05em', fontWeight: 'bold' },
  { tag: tags.heading6, fontSize: '1em', fontWeight: 'bold' },

  // Inline formatting
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },

  // Code
  { tag: tags.monospace, fontFamily: 'ui-monospace, monospace', fontSize: '0.9em' },

  // Links & URLs
  { tag: tags.link, color: '#0969da', textDecoration: 'underline' },
  { tag: tags.url, color: '#0969da' },

  // Markdown meta characters (# * ``` etc.)
  { tag: tags.processingInstruction, color: '#6e7781' },
  { tag: tags.meta, color: '#6e7781' },

  // Quotes
  { tag: tags.quote, color: '#656d76', fontStyle: 'italic' },

  // Lists
  { tag: tags.list, color: '#953800' },

  // Programming language tokens (for fenced code blocks)
  { tag: tags.keyword, color: '#cf222e' },
  { tag: tags.string, color: '#0a3069' },
  { tag: tags.comment, color: '#6e7781', fontStyle: 'italic' },
  { tag: tags.number, color: '#0550ae' },
  { tag: tags.bool, color: '#0550ae' },
  { tag: tags.operator, color: '#cf222e' },
  { tag: tags.definition(tags.variableName), color: '#8250df' },
  { tag: tags.function(tags.variableName), color: '#8250df' },
  { tag: tags.typeName, color: '#953800' },
  { tag: tags.className, color: '#953800' },
  { tag: tags.propertyName, color: '#0550ae' },
  { tag: tags.atom, color: '#0550ae' },
  { tag: tags.regexp, color: '#0a3069' },
]);

export function markdownHighlighting(): Extension {
  return syntaxHighlighting(markdownHighlightStyle);
}
