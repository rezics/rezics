import { linter, type Diagnostic } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';

function jsonLinter() {
  return linter((view) => {
    const text = view.state.doc.toString();
    if (!text.trim()) return [];

    try {
      JSON.parse(text);
      return [];
    } catch (e) {
      const message = e instanceof SyntaxError ? e.message : 'Invalid JSON';
      // Try to extract position from error message
      const posMatch = message.match(/position\s+(\d+)/i);
      const pos = posMatch ? parseInt(posMatch[1], 10) : 0;
      const from = Math.min(pos, text.length);
      const to = Math.min(from + 1, text.length);

      const diagnostics: Diagnostic[] = [
        {
          from,
          to,
          severity: 'error',
          message,
        },
      ];
      return diagnostics;
    }
  });
}

export function jsonLintExtension(): Extension {
  return jsonLinter();
}
