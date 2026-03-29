import type { KeyBinding } from '@codemirror/view';
import { toggleBold, toggleItalic, toggleCode, insertLink } from './commands';

export const markdownKeybindings: KeyBinding[] = [
  { key: 'Mod-b', run: toggleBold },
  { key: 'Mod-i', run: toggleItalic },
  { key: 'Mod-k', run: insertLink },
  { key: 'Mod-e', run: toggleCode },
];
