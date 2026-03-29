import type { ToolbarItem } from '../../toolbar/types';
import { formatJson } from '../core/commands';

export const jsonToolbarItems: ToolbarItem[] = [
  { name: 'format', label: 'Format', action: formatJson },
];
