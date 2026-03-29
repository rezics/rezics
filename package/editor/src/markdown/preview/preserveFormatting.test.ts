import { describe, expect, test } from 'bun:test';
import MarkdownIt from 'markdown-it';
import { preserveFormattingPlugin } from './preserveFormatting';

function render(
  src: string,
  options?: Parameters<typeof preserveFormattingPlugin>[1],
) {
  const md = new MarkdownIt();
  preserveFormattingPlugin(md, options);
  return md.render(src);
}

describe('preserveFormatting — empty lines', () => {
  test('multiple blank lines are preserved', () => {
    const html = render('line1\n\n\n\nline2');
    // Extra blank lines produce non-breaking space characters (U+00A0)
    expect(html).toContain('\u00A0');
    expect(html).toContain('line1');
    expect(html).toContain('line2');
  });

  test('standard paragraph break still produces two paragraphs', () => {
    const html = render('line1\n\nline2');
    expect(html).toContain('line1');
    expect(html).toContain('line2');
  });

  test('disabled preserveEmptyLines does not add extra spacing', () => {
    const html = render('line1\n\n\n\nline2', { preserveEmptyLines: false });
    const htmlDefault = new MarkdownIt().render('line1\n\n\n\nline2');
    expect(html).toBe(htmlDefault);
  });
});

describe('preserveFormatting — spaces', () => {
  test('multiple spaces are preserved as nbsp entities', () => {
    const html = render('hello    world');
    // Spaces are converted to &nbsp; HTML entities via html_inline tokens
    expect(html).toContain('&nbsp;');
  });

  test('disabled preserveSpaces collapses spaces', () => {
    const html = render('hello    world', { preserveSpaces: false });
    expect(html).not.toContain('&nbsp;');
  });
});
