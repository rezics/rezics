import { Folio, type FolioNode, type RendererPlugin } from "@rezics/folio";
import { createEpubPlugin } from "@rezics/folio/plugin/epub";
import { useEffect, useState } from "react";
import { useFileUpload } from "../../_fixture-helpers";
import { WRAPPER_STYLE } from "../../_stubs";

type EpubResult = {
  plugin: RendererPlugin;
  tree: FolioNode[];
  cleanup: () => void;
};

function Default() {
  const { file, FileInput } = useFileUpload(".epub");
  const [result, setResult] = useState<EpubResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!file) {
      setResult(null);
      setError(null);
      return;
    }

    let cancelled = false;
    let cleanupFn: (() => void) | undefined;

    createEpubPlugin(file)
      .then((epubResult) => {
        if (!cancelled) {
          cleanupFn = epubResult.cleanup;
          setResult(epubResult);
        } else {
          epubResult.cleanup();
        }
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err : new Error(String(err)));
      });

    return () => {
      cancelled = true;
      cleanupFn?.();
    };
  }, [file]);

  if (!file) return <FileInput />;

  if (error) {
    return (
      <div style={{ padding: 32, color: "#e53e3e" }}>
        Failed to load EPUB: {error.message}
      </div>
    );
  }

  if (!result) {
    return <div style={{ padding: 32, opacity: 0.6 }}>Loading EPUB...</div>;
  }

  return (
    <div style={WRAPPER_STYLE}>
      <Folio tree={result.tree} plugins={[result.plugin]} />
    </div>
  );
}

export default { Default };
