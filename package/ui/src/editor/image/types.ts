import type {ReactNode} from 'react';

export interface ImageProvider {
  name: string;
  label: string;
  icon: ReactNode;
  render: (props: {onInsert: (url: string, alt?: string) => void}) => ReactNode;
}
