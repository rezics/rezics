import { useState, useEffect } from 'react';
import { Folio } from '@rezics/folio';
import { createTxtPlugin } from '@rezics/folio/plugin/txt';
import { WRAPPER_STYLE } from '../../_stubs';
import { useFileUpload } from '../../_fixture-helpers';

function Default() {
  const { file, FileInput } = useFileUpload('.txt,.text,.md');
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setText(null);
      return;
    }
    file.text().then(setText);
  }, [file]);

  if (!file) return <FileInput />;

  if (text === null) {
    return <div style={{ padding: 32, opacity: 0.6 }}>Reading file...</div>;
  }

  const { plugin, tree } = createTxtPlugin(text);
  return (
    <div style={WRAPPER_STYLE}>
      <Folio tree={tree} plugins={[plugin]} />
    </div>
  );
}

export default { Default };
