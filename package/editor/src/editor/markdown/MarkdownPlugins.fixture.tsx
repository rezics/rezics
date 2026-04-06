import { MarkdownEditor } from "../MarkdownEditor";
import { stubEmojiConfig, stubMentionConfig } from "./_stubs";

const sampleMarkdown = `# Plugin Demo

Type @ to trigger mentions. Try @Alice or @Bob.

This editor tests plugin combinations.

- **Mention**: autocomplete on @ trigger
- **Emoji**: emoji picker integration
- **Preview**: rendered markdown output
`;

export default {
  WithMention: () => (
    <MarkdownEditor
      value={sampleMarkdown}
      mention={stubMentionConfig}
      preview={false}
      className="h-screen"
    />
  ),

  WithEmoji: () => (
    <MarkdownEditor
      value={sampleMarkdown}
      emoji={stubEmojiConfig}
      preview={false}
      className="h-screen"
    />
  ),

  AllPlugins: () => (
    <MarkdownEditor
      value={sampleMarkdown}
      mention={stubMentionConfig}
      emoji={stubEmojiConfig}
      preview={true}
      className="h-screen"
    />
  ),
};
