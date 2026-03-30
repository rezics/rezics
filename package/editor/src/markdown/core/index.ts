import type { EditorPlugin } from '../../core/types';
import { markdownLanguageSupport, type MarkdownLanguageConfig } from './language';
import { markdownKeybindings } from './keybindings';
import { markdownToolbarItems } from '../toolbar/index';

export function markdown(config?: MarkdownLanguageConfig): EditorPlugin {
  return {
    name: 'markdown',
    extensions: markdownLanguageSupport(config),
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
