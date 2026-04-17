import { createRezicsRenderer } from "@rezics/editor/markdown";
import { useMemo } from "react";

const md = createRezicsRenderer({ html: false });

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
        padding: "16px 24px",
        maxWidth: "720px",
        margin: "0 auto",
        wordBreak: "break-word",
        overflowWrap: "break-word",
      }}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: intentional HTML rendering
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
