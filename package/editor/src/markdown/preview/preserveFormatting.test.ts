import { describe, expect, test } from 'bun:test';
import MarkdownIt from 'markdown-it';
import {
  emptyLinesPlugin,
  preserveSpacesPlugin,
  novelModePlugin,
  preserveFormattingPlugin,
  createNovelRenderer,
} from './preserveFormatting';

// ── emptyLinesPlugin ────────────────────────────────────────────────

describe('emptyLinesPlugin', () => {
  function setup(src: string) {
    const md = new MarkdownIt().use(emptyLinesPlugin);
    return { tokens: md.parse(src, {}), html: md.render(src) };
  }

  test('two empty lines produce two empty_line tokens', () => {
    // A\n\n\nB = 2 empty lines between A and B
    const { tokens } = setup('Hello\n\n\nWorld');
    const empties = tokens.filter(t => t.type === 'empty_line');
    expect(empties).toHaveLength(2);
  });

  test('standard paragraph break produces no empty_line tokens', () => {
    const { tokens } = setup('Hello\n\nWorld');
    const empties = tokens.filter(t => t.type === 'empty_line');
    expect(empties).toHaveLength(0);
  });

  test('renders empty_line as br', () => {
    const { html } = setup('Hello\n\n\nWorld');
    expect(html).toContain('<br class="preserved-empty-line">');
  });

  test('leading blank lines produce no tokens', () => {
    const { tokens } = setup('\n\n\nHello');
    const empties = tokens.filter(t => t.type === 'empty_line');
    expect(empties).toHaveLength(0);
  });

  test('three empty lines produce three empty_line tokens', () => {
    // A\n\n\n\nB = 3 empty lines between A and B
    const { tokens } = setup('A\n\n\n\nB');
    const empties = tokens.filter(t => t.type === 'empty_line');
    expect(empties).toHaveLength(3);
  });
});

// ── preserveSpacesPlugin ────────────────────────────────────────────

describe('preserveSpacesPlugin', () => {
  function render(src: string) {
    return new MarkdownIt().use(preserveSpacesPlugin).render(src);
  }

  test('multiple spaces are preserved as &nbsp; entities', () => {
    const html = render('hello    world');
    expect(html).toContain('&nbsp;');
  });

  test('single space is left unchanged', () => {
    const html = render('hello world');
    expect(html).not.toContain('&nbsp;');
  });
});

// ── novelModePlugin ─────────────────────────────────────────────────

describe('novelModePlugin', () => {
  function render(src: string) {
    return new MarkdownIt().use(novelModePlugin).render(src);
  }

  test('single newline renders as <br>', () => {
    const html = render('line1\nline2');
    expect(html).toContain('<br>');
  });

  test('extra blank lines are preserved', () => {
    const html = render('A\n\n\nB');
    expect(html).toContain('<br class="preserved-empty-line">');
  });

  test('inline spaces are preserved', () => {
    const html = render('hello    world');
    expect(html).toContain('&nbsp;');
  });
});

// ── preserveFormattingPlugin (backward compat) ──────────────────────

describe('preserveFormattingPlugin', () => {
  test('disabled preserveEmptyLines skips empty_line injection', () => {
    const md = new MarkdownIt().use(preserveFormattingPlugin, {
      preserveEmptyLines: false,
    });
    const html = md.render('A\n\n\n\nB');
    const defaultHtml = new MarkdownIt().render('A\n\n\n\nB');
    expect(html).toBe(defaultHtml);
  });

  test('disabled preserveSpaces collapses spaces', () => {
    const md = new MarkdownIt().use(preserveFormattingPlugin, {
      preserveSpaces: false,
    });
    const html = md.render('hello    world');
    expect(html).not.toContain('&nbsp;');
  });
});

// ── createNovelRenderer ─────────────────────────────────────────────

describe('createNovelRenderer', () => {
  test('returns a working MarkdownIt instance', () => {
    const md = createNovelRenderer();
    const html = md.render('Hello\nWorld');
    expect(html).toContain('<br>');
  });

  test('respects html option', () => {
    const md = createNovelRenderer({ html: true });
    const html = md.render('<em>test</em>');
    expect(html).toContain('<em>test</em>');
  });

  test('html disabled by default', () => {
    const md = createNovelRenderer();
    const html = md.render('<em>test</em>');
    expect(html).not.toContain('<em>test</em>');
  });
});
