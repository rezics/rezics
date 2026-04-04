import {JsonEditor} from '../JsonEditor';

const sampleJson = JSON.stringify(
  {hello: 'world', count: 42, nested: {key: 'value'}},
  null,
  2,
);

export default {
  DefaultToolbar: () => <JsonEditor value={sampleJson} className="h-screen" />,

  CustomFormatIcon: () => (
    <JsonEditor
      value={sampleJson}
      toolbar={{
        icons: {
          format: <span style={{fontSize: 14, fontFamily: 'monospace'}}>{'{}'}</span>,
        },
      }}
      className="h-screen"
    />
  ),

  NoToolbar: () => (
    <JsonEditor value={sampleJson} toolbar={false} className="h-screen" />
  ),
};
