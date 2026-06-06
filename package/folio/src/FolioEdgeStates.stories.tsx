import { Folio, type FolioNode } from "@rezics/folio";
import { createTxtPlugin } from "@rezics/folio/plugins/txt";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { buildTree, FALLBACK_TEXT, WRAPPER_STYLE } from "./_stubs";

const meta = {
  title: "Folio/Edge States",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoadingState: Story = {
  render: () => {
    const tree: FolioNode[] = [
      {
        id: "loading-ch",
        title: "Loading Chapter",
        fetch: () => new Promise(() => {}),
      },
    ];
    const { plugin } = createTxtPlugin(FALLBACK_TEXT);
    return (
      <div style={WRAPPER_STYLE}>
        <Folio
          tree={tree}
          plugins={[plugin]}
          renderLoading={() => (
            <div style={{ padding: 32, textAlign: "center", opacity: 0.6 }}>
              Loading content...
            </div>
          )}
        />
      </div>
    );
  },
};

export const ErrorState: Story = {
  render: () => {
    const tree: FolioNode[] = [
      {
        id: "error-ch",
        title: "Error Chapter",
        fetch: () =>
          Promise.reject(new Error("Failed to load chapter content")),
      },
    ];
    const { plugin } = createTxtPlugin(FALLBACK_TEXT);
    return (
      <div style={WRAPPER_STYLE}>
        <Folio
          tree={tree}
          plugins={[plugin]}
          renderError={(error, retry) => (
            <div style={{ padding: 32, textAlign: "center" }}>
              <p style={{ color: "#e53e3e" }}>{error.message}</p>
              <button
                type="button"
                onClick={retry}
                style={{ marginTop: 8, cursor: "pointer" }}
              >
                Retry
              </button>
            </div>
          )}
        />
      </div>
    );
  },
};

export const EmptyTree: Story = {
  render: () => {
    const { plugin } = createTxtPlugin(FALLBACK_TEXT);
    return (
      <div style={WRAPPER_STYLE}>
        <Folio tree={[]} plugins={[plugin]} />
      </div>
    );
  },
};

export const NoRenderer: Story = {
  render: () => {
    const tree = buildTree(
      [
        {
          id: "unknown-ch",
          title: "Unknown Format",
          content: "This content has no matching renderer.",
          contentType: "application/x-unknown",
        },
      ],
      "application/x-unknown",
    );
    return (
      <div style={WRAPPER_STYLE}>
        <Folio tree={tree} plugins={[]} />
      </div>
    );
  },
};
