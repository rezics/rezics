import type { FolioNode, RendererPlugin } from '../../types';
import { splitTxt, type TxtSplitOptions, type TxtSplitResult } from './split';
import { TxtRenderer } from './TxtRenderer';
import { createTxtSettings } from './TxtSettings';

export type { TxtSplitOptions, TxtSplitResult };
export { splitTxt };

export function createTxtPlugin(
  raw: string,
  options?: TxtSplitOptions,
): { plugin: RendererPlugin; tree: FolioNode[] } {
  let currentResult = splitTxt(raw, options);

  const Settings = createTxtSettings(
    raw,
    currentResult,
    (rules: RegExp[]) => {
      currentResult = splitTxt(raw, { splitRules: rules });
      return currentResult;
    },
  );

  const plugin: RendererPlugin = {
    kind: 'renderer',
    id: 'txt',
    contentTypes: ['txt', 'text'],
    Renderer: TxtRenderer,
    Settings,
  };

  return { plugin, tree: currentResult.tree };
}
