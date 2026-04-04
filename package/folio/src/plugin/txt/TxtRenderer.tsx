import { useMemo } from 'react';
import { createNovelRenderer } from '@rezics/editor/markdown';

const md = createNovelRenderer({ html: false });

interface TxtRendererProps {
  raw: string;
  meta?: Record<string, unknown>;
}

export function TxtRenderer({ raw }: TxtRendererProps) {
  const html = useMemo(() => md.render(raw), [raw]);

  return (
    <div
      className="folio-txt-content"
      style={{
        padding: '16px 24px',
        maxWidth: '720px',
        margin: '0 auto',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
