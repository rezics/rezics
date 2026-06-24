import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";

import { ExternalLinkModal } from "./ExternalLinkModal";
import { closeExternal, openExternal } from "./store";

function ExternalLinkModalPreview({ href }: { href: string }) {
  useEffect(() => {
    openExternal(href);
    return () => {
      closeExternal();
    };
  }, [href]);
  return (
    <div>
      <p className="text-sm text-neutral-700">
        The external-link modal opens automatically when{" "}
        <code>openExternal()</code> is called from any{" "}
        <code>&lt;SafeLink&gt;</code> click.
      </p>
      <ExternalLinkModal />
    </div>
  );
}

const meta = {
  title: "Composite/Link/ExternalLinkModal",
  component: ExternalLinkModalPreview,
  args: { href: "https://example.com/article" },
} satisfies Meta<typeof ExternalLinkModalPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
