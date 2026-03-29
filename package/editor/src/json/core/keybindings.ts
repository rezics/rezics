import type { KeyBinding } from '@codemirror/view';
import { formatJson } from './commands';

export const jsonKeybindings: KeyBinding[] = [
  { key: 'Shift-Mod-f', run: formatJson },
];
