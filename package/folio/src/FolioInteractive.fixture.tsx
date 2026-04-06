import {
  type FolioNode,
  FolioProvider,
  type RendererPlugin,
  useFolio,
} from "@rezics/folio";
import { createEpubPlugin } from "@rezics/folio/plugin/epub";
import { createTxtPlugin } from "@rezics/folio/plugin/txt";
import { useEffect, useState } from "react";
import { useFixtureInput, useFixtureSelect } from "react-cosmos/client";
import { FixtureReader, useFileUpload } from "./_fixture-helpers";
import { WRAPPER_STYLE } from "./_stubs";

// ---------------------------------------------------------------------------
// Cosmos controls for Folio state
// ---------------------------------------------------------------------------

function InteractiveControls() {
  const { dispatch } = useFolio();

  const [theme] = useFixtureSelect("Theme", {
    options: ["light", "dark", "sepia"],
    defaultValue: "light",
  });

  const [readMode] = useFixtureSelect("Read Mode", {
    options: ["scroll", "page"],
    defaultValue: "page",
  });

  const [turnStyle] = useFixtureSelect("Turn Style", {
    options: ["rotate", "slide", "fade"],
    defaultValue: "rotate",
  });

  const [fontSize] = useFixtureInput("Font Size", 16);
  const [lineHeight] = useFixtureInput("Line Height", 1.6);

  useEffect(() => {
    dispatch({
      type: "SET_THEME",
      theme: theme as "light" | "dark" | "sepia",
    });
  }, [theme, dispatch]);

  useEffect(() => {
    dispatch({
      type: "SET_READ_MODE",
      mode: readMode as "scroll" | "page",
    });
  }, [readMode, dispatch]);

  useEffect(() => {
    dispatch({
      type: "SET_TURN_STYLE",
      style: turnStyle as "rotate" | "slide" | "fade",
    });
  }, [turnStyle, dispatch]);

  useEffect(() => {
    dispatch({ type: "SET_FONT_SIZE", size: fontSize });
  }, [fontSize, dispatch]);

  useEffect(() => {
    dispatch({ type: "SET_LINE_HEIGHT", height: lineHeight });
  }, [lineHeight, dispatch]);

  return null;
}

// ---------------------------------------------------------------------------
// EPUB upload + plugin creation
// ---------------------------------------------------------------------------

type FormatResult = {
  tree: FolioNode[];
  plugins: RendererPlugin[];
  cleanup?: () => void;
};

function useEpubFromFile(file: File | null) {
  const [result, setResult] = useState<FormatResult | null>(null);
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
          setResult({
            tree: epubResult.tree,
            plugins: [epubResult.plugin],
            cleanup: epubResult.cleanup,
          });
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

  return { result, error };
}

// ---------------------------------------------------------------------------
// TXT upload + plugin creation
// ---------------------------------------------------------------------------

function useTxtFromFile(file: File | null) {
  const [result, setResult] = useState<FormatResult | null>(null);

  useEffect(() => {
    if (!file) {
      setResult(null);
      return;
    }
    file.text().then((text) => {
      const { plugin, tree } = createTxtPlugin(text);
      setResult({ tree, plugins: [plugin] });
    });
  }, [file]);

  return result;
}

// ---------------------------------------------------------------------------
// Interactive fixture
// ---------------------------------------------------------------------------

function Interactive() {
  const [format] = useFixtureSelect("Format", {
    options: ["TXT", "EPUB"],
    defaultValue: "TXT",
  });

  const txtUpload = useFileUpload(".txt,.text,.md");
  const epubUpload = useFileUpload(".epub");

  const txtResult = useTxtFromFile(format === "TXT" ? txtUpload.file : null);
  const epub = useEpubFromFile(format === "EPUB" ? epubUpload.file : null);

  // Show file input when no file selected for active format
  if (format === "TXT" && !txtUpload.file) {
    return <txtUpload.FileInput />;
  }

  if (format === "EPUB" && !epubUpload.file) {
    return <epubUpload.FileInput />;
  }

  // EPUB error/loading
  if (format === "EPUB") {
    if (epub.error) {
      return (
        <div
          style={{
            ...WRAPPER_STYLE,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <p style={{ color: "#e53e3e" }}>
            Failed to load EPUB: {epub.error.message}
          </p>
        </div>
      );
    }
    if (!epub.result) {
      return (
        <div
          style={{
            ...WRAPPER_STYLE,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.6,
          }}
        >
          Loading EPUB...
        </div>
      );
    }
  }

  // TXT loading
  if (format === "TXT" && !txtResult) {
    return (
      <div
        style={{
          ...WRAPPER_STYLE,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.6,
        }}
      >
        Reading file...
      </div>
    );
  }

  const { tree, plugins } =
    format === "EPUB" && epub.result ? epub.result : txtResult!;

  return (
    <div style={WRAPPER_STYLE}>
      <FolioProvider
        key={`${format}-${format === "TXT" ? txtUpload.file?.name : epubUpload.file?.name}`}
        tree={tree}
        plugins={plugins}
      >
        <InteractiveControls />
        <FixtureReader />
      </FolioProvider>
    </div>
  );
}

export default { Interactive };
