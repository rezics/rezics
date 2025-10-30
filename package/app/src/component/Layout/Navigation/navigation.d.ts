import type React from 'react';

export interface NavigationItem {
  kind: 'header' | 'divider' | 'item';
  title?: string;
  segment?: string;
  icon?: React.ReactNode;
  children?: NavigationItem[];
}
