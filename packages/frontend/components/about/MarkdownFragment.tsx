import { parseMarkdownFragment } from "@/lib/about/markdown";

export function MarkdownFragment({
  source,
  variant = "body",
}: {
  source: string;
  variant?: "body" | "hero";
}) {
  const blocks = parseMarkdownFragment(source);

  return (
    <div className={`about-prose about-prose-${variant}`}>
      {blocks.map((block, index) =>
        block.kind === "heading" ? (
          <h2 key={`${block.kind}-${index}`}>{block.text}</h2>
        ) : (
          <p key={`${block.kind}-${index}`}>{block.text}</p>
        ),
      )}
    </div>
  );
}
