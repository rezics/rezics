import type {ReactElement, ReactNode} from 'react';

export interface ImageProvider {
  name: string;
  label: string;
  icon: ReactElement;
  render: (props: {onInsert: (url: string, alt?: string) => void}) => ReactNode;
}
