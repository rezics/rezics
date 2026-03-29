import type { EditorPlugin } from '../../core/types';
import type { ToolbarItem } from '../../toolbar/types';
import { previewExtension, type PreviewConfig } from './preview';

const previewToolbarItems: ToolbarItem[] = [
  {
    name: 'preview',
    label: 'Preview',
    action: () => {
      // Toggle is handled by the panel extension visibility
    },
  },
];

export function preview(config?: PreviewConfig): EditorPlugin {
  return {
    name: 'preview',
    extensions: previewExtension(config),
    toolbar: previewToolbarItems,
  };
}

export type { PreviewConfig } from './preview';
export { preserveFormattingPlugin } from './preserveFormatting';
export type { PreserveFormatOptions } from './preserveFormatting';
