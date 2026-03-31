import { CodeEditor } from './CodeEditor';

const sampleText = `The editor with no language plugins acts as a plain text / code input.

You can type freely here. This is useful as a base-level test
of the core editor functionality: cursor movement, selection,
undo/redo, and basic keybindings.
`;

export default function CodeEditorFixture() {
  return <CodeEditor value={sampleText} className="h-screen" />;
}
