import { useState } from "react";
import { useFixtureSelect } from "react-cosmos/client";
import { MarkdownEditor } from "../MarkdownEditor";

const previewMarkdown = `# Preview Demo

Some **bold** and *italic* text with \`inline code\`.

> A blockquote with **nested formatting**.

- Bullet one
- Bullet two

\`\`\`typescript
interface User {
  id: string;
  name: string;
  email: string;
}

function greet(user: User): string {
  return \`Hello, \${user.name}!\`;
}
\`\`\`

\`\`\`python
def fibonacci(n: int) -> list[int]:
    seq = [0, 1]
    for _ in range(n - 2):
        seq.append(seq[-1] + seq[-2])
    return seq
\`\`\`

\`\`\`css
.container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
\`\`\`

| Feature | Status |
|---------|--------|
| Bold    | Done   |
| Preview | Done   |
`;

const novelContent = `# Novel Formatting

This paragraph has    multiple    spaces    between    words.

And this paragraph is separated by extra blank lines.


Like this one — there should be visible vertical spacing preserved.



Three blank lines above this paragraph.

Regular paragraph with no special spacing follows.

Another paragraph with  double  spaces  in  the  middle  of  sentences.
`;

function ViewModesFixture() {
  const [viewMode] = useFixtureSelect("View Mode", {
    options: ["write", "preview", "dual"] as const,
    defaultValue: "write",
  });

  // MarkdownEditor manages viewMode internally, so we wrap it to start in the selected mode
  // The fixture demonstrates the component; users click tabs to switch
  return (
    <MarkdownEditor
      key={viewMode}
      value={previewMarkdown}
      preview={true}
      className="h-screen"
    />
  );
}

function FullscreenFixture() {
  const [active, setActive] = useState(true);
  return (
    <div>
      {!active && (
        <button
          type="button"
          onClick={() => setActive(true)}
          style={{ margin: 8 }}
        >
          Re-mount editor
        </button>
      )}
      {active && (
        <MarkdownEditor
          value={previewMarkdown}
          preview={true}
          className="h-screen"
        />
      )}
    </div>
  );
}

export default {
  ViewModes: <ViewModesFixture />,

  Fullscreen: <FullscreenFixture />,

  NoHighlight: () => (
    <MarkdownEditor
      value={previewMarkdown}
      preview={{ highlight: false }}
      className="h-screen"
    />
  ),

  NovelFormatting: () => (
    <MarkdownEditor value={novelContent} preview={true} className="h-screen" />
  ),

  CodeBlocks: () => (
    <MarkdownEditor
      value={previewMarkdown}
      preview={true}
      className="h-screen"
    />
  ),
};
