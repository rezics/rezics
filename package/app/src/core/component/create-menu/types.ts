import type {ReactNode} from 'react';

export type CreateMenuItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  dividerAbove?: boolean;
};
