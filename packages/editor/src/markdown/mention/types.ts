import type { ReactNode } from "react";

export interface MentionItem {
  id: string;
  label: string;
  [key: string]: unknown;
}

export interface MentionConfig {
  source: (query: string) => Promise<MentionItem[]>;
  renderItem?: (item: MentionItem) => ReactNode;
  formatMention?: (item: MentionItem) => string;
}
