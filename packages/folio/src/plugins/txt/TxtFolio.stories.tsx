import { Folio } from "@rezics/folio";
import { createTxtPlugin } from "@rezics/folio/plugins/txt";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";

import { useFileUpload } from "../../_fixture-helpers";
import { WRAPPER_STYLE } from "../../_stubs";

function TxtInteractive() {
  const { file, FileInput } = useFileUpload(".txt,.text,.md");
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

const meta = {
  title: "Folio/Plugins/TXT",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <TxtInteractive />,
};
