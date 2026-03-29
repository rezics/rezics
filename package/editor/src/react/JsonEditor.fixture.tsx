import { Editor } from './Editor';
import { json } from '../json/core/index';
import { jsonFull } from '../json/index';

const validJson = JSON.stringify(
  {
    name: '@package/editor',
    version: '1.0.50',
    type: 'module',
    dependencies: {
      '@codemirror/state': '^6.6.0',
      '@codemirror/view': '^6.40.0',
    },
    features: ['markdown', 'json', 'plugins', 'toolbar'],
  },
  null,
  2,
);

const invalidJson = `{
  "name": "@package/editor",
  "version": "1.0.50",
  "missing_comma": true
  "this_will_error": false
}`;

export default {
  Basic: () => (
    <Editor
      value={validJson}
      plugins={[json()]}
      toolbar="react"
      className="h-screen"
    />
  ),

  WithLint: () => (
    <Editor
      value={invalidJson}
      plugins={jsonFull()}
      toolbar="react"
      className="h-screen"
    />
  ),

  ValidJson: () => (
    <Editor
      value={validJson}
      plugins={jsonFull()}
      toolbar="react"
      className="h-screen"
    />
  ),
};
