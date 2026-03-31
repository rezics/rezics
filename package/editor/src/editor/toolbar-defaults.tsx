import type { ReactNode } from 'react';
import {
  Bold,
  Italic,
  Heading,
  Quote,
  List,
  ListOrdered,
  Link,
  Image,
  Table,
  Code,
  Eye,
  Braces,
  Columns2,
  Maximize,
} from 'lucide-react';

export const markdownIconMap: Record<string, ReactNode> = {
  bold: <Bold size={16} />,
  italic: <Italic size={16} />,
  heading: <Heading size={16} />,
  blockquote: <Quote size={16} />,
  'unordered-list': <List size={16} />,
  'ordered-list': <ListOrdered size={16} />,
  link: <Link size={16} />,
  image: <Image size={16} />,
  table: <Table size={16} />,
  'code-block': <Code size={16} />,
  preview: <Eye size={16} />,
  'dual-column': <Columns2 size={16} />,
  fullscreen: <Maximize size={16} />,
};

export const jsonIconMap: Record<string, ReactNode> = {
  format: <Braces size={16} />,
};
