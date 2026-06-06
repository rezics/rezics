import type { ReactElement, ReactNode } from "react";

export type ImageUploadAdapter = (
  file: File,
) => Promise<{ url: string; alt?: string }>;

export interface ImageProvider {
  name: string;
  label: string;
  icon: ReactElement;
  render: (props: {
    onInsert: (url: string, alt?: string) => void;
  }) => ReactNode;
}
