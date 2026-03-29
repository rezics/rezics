import type { EditorPlugin } from '../../core/types';
import { markdownLanguageSupport } from './language';
import { markdownKeybindings } from './keybindings';
import { markdownToolbarItems } from '../toolbar/index';

export function markdown(): EditorPlugin {
  return {
    name: 'markdown',
    extensions: markdownLanguageSupport(),
    keybindings: markdownKeybindings,
    toolbar: markdownToolbarItems,
  };
}

export {
  toggleBold,
  toggleItalic,
  toggleStrikethrough,
  toggleHeading,
  toggleBlockquote,
  toggleUnorderedList,
  toggleOrderedList,
  toggleCode,
  toggleCodeBlock,
  insertLink,
  insertImage,
  insertTable,
} from './commands';
