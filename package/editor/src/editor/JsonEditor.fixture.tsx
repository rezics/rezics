import {JsonEditor} from './JsonEditor';

const validJson = JSON.stringify(
  {
    name: '@rezics/editor',
    version: '1.0.50',
    type: 'module',
    published: true,
    mock_number_data: 1234567890,
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
  "name": "@rezics/editor",
  "version": "1.0.50",
  "missing_comma": true
  "this_will_error": false
}`;

export default {
  Default: () => <JsonEditor value={validJson} className="h-screen" />,

  WithLint: () => <JsonEditor value={invalidJson} className="h-screen" />,

  NoLint: () => (
    <JsonEditor value={validJson} lint={false} className="h-screen" />
  ),
};
