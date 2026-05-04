import { useCallback, useRef, useState } from "react";
import { FolioProvider, useFolio } from "./context";
import { useFolioGesture } from "./gesture/useFolioGesture";
import { useKeyboardNav } from "./gesture/useKeyboardNav";
import { PageContainer } from "./pagination/PageContainer";
import { ScrollContainer } from "./pagination/ScrollContainer";
import { PanelSlot } from "./panel/PanelSlot";
import { ContentRenderer } from "./render/ContentRenderer";
import { getThemeVars } from "./styles/theme";
import { TocPanel } from "./toc/TocPanel";
import type { FolioProps } from "./types";
import { X as CloseIcon, Menu as MenuIcon } from "lucide-react";

function FolioInner({
  onTreeChange,
  renderLoading,
  renderError,
}: Pick<FolioProps, "onTreeChange" | "renderLoading" | "renderError">) {
  const { state } = useFolio();
  const [showUI, setShowUI] = useState(true);
  const [showToc, setShowToc] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  const toggleUI = useCallback(() => setShowUI((v) => !v), []);

  const { bind, navigate } = useFolioGesture({
    containerRef,
    innerRef,
    onToggleUI: toggleUI,
  });

  useKeyboardNav({
    enabled: state.readMode === "page",
    onNext: () => navigate("next"),
    onPrev: () => navigate("prev"),
  });

  const themeVars = getThemeVars(state.theme);

  // Loading state
  if (state.status.state === "loading") {
    return (
      <div className="folio-loading" style={{ ...themeVars, height: "100%" }}>
        {renderLoading ? renderLoading() : <DefaultLoading />}
      </div>
    );
  }

  // Error state
  if (state.status.state === "error") {
    const { error, retry } = state.status;
    return (
      <div className="folio-error" style={{ ...themeVars, height: "100%" }}>
        {renderError ? (
          renderError(error, retry)
        ) : (
          <DefaultError error={error} retry={retry} />
        )}
      </div>
    );
  }

  const Container = state.readMode === "page" ? PageContainer : ScrollContainer;

  return (
    <div
      className="folio-root"
      style={{
        ...themeVars,
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        padding:
          "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)",
      }}
    >
      {/* TOC Sidebar */}
      {showToc && (
        <div
          className="folio-toc-sidebar"
          style={{
            width: "280px",
            flexShrink: 0,
            borderRight: "1px solid var(--colors-border-whisper)",
            ...themeVars,
          }}
        >
          <TocPanel />
        </div>
      )}

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        {/* Toolbar */}
        {showUI && (
          <div
            className="folio-toolbar"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 12px",
              borderBottom: "1px solid var(--colors-border-whisper)",
            }}
          >
            <button
              type="button"
              onClick={() => setShowToc((v) => !v)}
              style={{
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                background: "transparent",
                border: "none",
                padding: "4px",
              }}
              aria-label={showToc ? "Close table of contents" : "Open table of contents"}
            >
              {showToc ? (
                <CloseIcon fontSize="small" />
              ) : (
                <MenuIcon fontSize="small" />
              )}
            </button>
            <PanelSlot slot="Toolbar" onTreeChange={onTreeChange} />
          </div>
        )}

        {/* Content */}
        <div
          {...(state.readMode === "page" ? bind() : {})}
          ref={containerRef}
          style={{
            flex: 1,
            overflow: "hidden",
            touchAction: state.readMode === "page" ? "none" : "auto",
          }}
        >
          <Container>
            <div ref={innerRef}>
              <ContentRenderer />
            </div>
          </Container>
        </div>

        {/* Controls */}
        {showUI && (
          <div
            className="folio-controls"
            style={{
              padding: "8px 12px",
              borderTop: "1px solid var(--colors-border-whisper)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
              fontSize: "13px",
            }}
          >
            {state.readMode === "page" && state.pageCount > 0 && (
              <span>
                {state.pageIndex + 1} / {state.pageCount}
              </span>
            )}
            <PanelSlot slot="Controls" onTreeChange={onTreeChange} />
          </div>
        )}
      </div>

      {/* Settings Drawer — could be a modal/drawer, for now a side panel */}
      <PanelSlot slot="Settings" onTreeChange={onTreeChange} />
    </div>
  );
}

function DefaultLoading() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
      }}
    >
      Loading...
    </div>
  );
}

function DefaultError({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: "12px",
      }}
    >
      <p>Failed to load chapter: {error.message}</p>
      <button type="button" onClick={retry} style={{ cursor: "pointer" }}>
        Retry
      </button>
    </div>
  );
}

export function Folio({
  tree,
  plugins,
  initialPosition,
  onProgressChange,
  onTreeChange,
  renderLoading,
  renderError,
  config,
}: FolioProps) {
  return (
    <FolioProvider
      tree={tree}
      plugins={plugins}
      initialPosition={initialPosition}
      config={config}
      onProgressChange={onProgressChange}
      onTreeChange={onTreeChange}
    >
      <FolioInner
        onTreeChange={onTreeChange}
        renderLoading={renderLoading}
        renderError={renderError}
      />
    </FolioProvider>
  );
}
