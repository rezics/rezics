import {
  type FolioNode,
  FolioProvider,
  type RendererPlugin,
  useFolio,
} from "@rezics/folio";
import { createEpubPlugin } from "@rezics/folio/plugins/epub";
import { createTxtPlugin } from "@rezics/folio/plugins/txt";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";

import { FixtureReader, useFileUpload } from "./_fixture-helpers";
import { WRAPPER_STYLE } from "./_stubs";

type Theme = "light" | "dark" | "sepia";
type ReadMode = "scroll" | "page";
type TurnStyle = "rotate" | "slide" | "fade";
type Format = "TXT" | "EPUB";

type Args = {
  format: Format;
  theme: Theme;
  readMode: ReadMode;
  turnStyle: TurnStyle;
  fontSize: number;
  lineHeight: number;
};

function InteractiveControls({
  theme,
  readMode,
  turnStyle,
  fontSize,
  lineHeight,
}: Omit<Args, "format">) {
  const { dispatch } = useFolio();

  useEffect(() => {
    dispatch({ type: "SET_THEME", theme });
  }, [theme, dispatch]);

  useEffect(() => {
    dispatch({ type: "SET_READ_MODE", mode: readMode });
  }, [readMode, dispatch]);

  useEffect(() => {
    dispatch({ type: "SET_TURN_STYLE", style: turnStyle });
  }, [turnStyle, dispatch]);

  useEffect(() => {
    dispatch({ type: "SET_FONT_SIZE", size: fontSize });
  }, [fontSize, dispatch]);

  useEffect(() => {
    dispatch({ type: "SET_LINE_HEIGHT", height: lineHeight });
  }, [lineHeight, dispatch]);

  return null;
}

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

function Interactive(args: Args) {
  const txtUpload = useFileUpload(".txt,.text,.md");
  const epubUpload = useFileUpload(".epub");

  const txtResult = useTxtFromFile(
    args.format === "TXT" ? txtUpload.file : null,
  );
  const epub = useEpubFromFile(args.format === "EPUB" ? epubUpload.file : null);

  if (args.format === "TXT" && !txtUpload.file) return <txtUpload.FileInput />;
  if (args.format === "EPUB" && !epubUpload.file)
    return <epubUpload.FileInput />;

  if (args.format === "EPUB") {
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

  if (args.format === "TXT" && !txtResult) {
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
    args.format === "EPUB" && epub.result ? epub.result : txtResult!;

  return (
    <div style={WRAPPER_STYLE}>
      <FolioProvider
        key={`${args.format}-${args.format === "TXT" ? txtUpload.file?.name : epubUpload.file?.name}`}
        tree={tree}
        plugins={plugins}
      >
        <InteractiveControls
          theme={args.theme}
          readMode={args.readMode}
          turnStyle={args.turnStyle}
          fontSize={args.fontSize}
          lineHeight={args.lineHeight}
        />
        <FixtureReader />
      </FolioProvider>
    </div>
  );
}

const meta = {
  title: "Folio/Interactive",
  args: {
    format: "TXT",
    theme: "light",
    readMode: "page",
    turnStyle: "rotate",
    fontSize: 16,
    lineHeight: 1.6,
  },
  argTypes: {
    format: { control: "radio", options: ["TXT", "EPUB"] },
    theme: { control: "radio", options: ["light", "dark", "sepia"] },
    readMode: { control: "radio", options: ["scroll", "page"] },
    turnStyle: { control: "radio", options: ["rotate", "slide", "fade"] },
    fontSize: { control: { type: "range", min: 12, max: 32, step: 1 } },
    lineHeight: { control: { type: "range", min: 1.2, max: 2.4, step: 0.1 } },
  },
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {
  render: (args) => <Interactive {...args} />,
};
