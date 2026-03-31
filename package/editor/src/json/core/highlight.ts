import {HighlightStyle, syntaxHighlighting} from '@codemirror/language';
import {tags} from '@lezer/highlight';
import type {Extension} from '@codemirror/state';

const jsonHighlightStyle = HighlightStyle.define([
  // Object keys
  {tag: tags.propertyName, color: '#1976d2'},

  // Values
  {tag: tags.string, color: '#1a7f37'},
  {tag: tags.number, color: '#8250df'},
  {tag: tags.bool, color: '#0078D4', fontWeight: 'bold'},
  {tag: tags.null, color: '#9a9ea6', fontStyle: 'italic'},

  // Structural characters
  {tag: tags.punctuation, color: '#57606a'},
  {tag: tags.brace, color: '#57606a'},
  {tag: tags.squareBracket, color: '#57606a'},
]);

export function jsonHighlighting(): Extension {
  return syntaxHighlighting(jsonHighlightStyle);
}
