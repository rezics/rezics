import type { EditorPlugin } from '../../core/types';
import { jsonLanguageSupport } from './language';
import { jsonKeybindings } from './keybindings';
import { jsonToolbarItems } from '../toolbar/index';

export function json(): EditorPlugin {
  return {
    name: 'json',
    extensions: jsonLanguageSupport(),
    keybindings: jsonKeybindings,
    toolbar: jsonToolbarItems,
  };
}

export { formatJson } from './commands';
