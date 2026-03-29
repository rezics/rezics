import type { EditorPlugin } from '../core/types';
import { json } from './core/index';
import { jsonLint } from './lint/index';

export interface JsonFullConfig {
  lint?: boolean;
}

export function jsonFull(config?: JsonFullConfig): EditorPlugin[] {
  const plugins: EditorPlugin[] = [json()];

  if (config?.lint !== false) {
    plugins.push(jsonLint());
  }

  return plugins;
}

// Re-export granular factories
export { json } from './core/index';
export { formatJson } from './core/commands';
export { jsonLint } from './lint/index';
