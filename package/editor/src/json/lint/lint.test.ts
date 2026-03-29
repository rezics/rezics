import { describe, expect, test } from 'bun:test';

// Test the JSON parse error extraction logic in isolation
function getJsonDiagnostic(text: string): { from: number; message: string } | null {
  if (!text.trim()) return null;
  try {
    JSON.parse(text);
    return null;
  } catch (e) {
    const message = e instanceof SyntaxError ? e.message : 'Invalid JSON';
    const posMatch = message.match(/position\s+(\d+)/i);
    const pos = posMatch ? parseInt(posMatch[1], 10) : 0;
    return { from: Math.min(pos, text.length), message };
  }
}

describe('JSON linting', () => {
  test('valid JSON produces no diagnostic', () => {
    expect(getJsonDiagnostic('{"key": "value"}')).toBeNull();
  });

  test('invalid JSON produces a diagnostic', () => {
    const result = getJsonDiagnostic('{"key": value}');
    expect(result).not.toBeNull();
    expect(result!.message).toContain('JSON');
  });

  test('empty string produces no diagnostic', () => {
    expect(getJsonDiagnostic('')).toBeNull();
    expect(getJsonDiagnostic('  ')).toBeNull();
  });

  test('diagnostic position is within text bounds', () => {
    const text = '{bad}';
    const result = getJsonDiagnostic(text);
    expect(result).not.toBeNull();
    expect(result!.from).toBeLessThanOrEqual(text.length);
    expect(result!.from).toBeGreaterThanOrEqual(0);
  });
});
