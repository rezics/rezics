import { Folio, type FolioNode } from "@rezics/folio";
import { createTxtPlugin } from "@rezics/folio/plugin/txt";
import { buildTree, FALLBACK_TEXT, WRAPPER_STYLE } from "./_stubs";

function LoadingState() {
  const tree: FolioNode[] = [
    {
      id: "loading-ch",
      title: "Loading Chapter",
      fetch: () => new Promise(() => {}), // never resolves
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
}

function ErrorState() {
  const tree: FolioNode[] = [
    {
      id: "error-ch",
      title: "Error Chapter",
      fetch: () => Promise.reject(new Error("Failed to load chapter content")),
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
}

function EmptyTree() {
  const { plugin } = createTxtPlugin(FALLBACK_TEXT);
  return (
    <div style={WRAPPER_STYLE}>
      <Folio tree={[]} plugins={[plugin]} />
    </div>
  );
}

function NoRenderer() {
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
}

export default { LoadingState, ErrorState, EmptyTree, NoRenderer };
