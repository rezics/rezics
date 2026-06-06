import type { FolioAction } from "@rezics/folio";
import { FolioProvider, useFolio } from "@rezics/folio";
import { createTxtPlugin } from "@rezics/folio/plugins/txt";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { StateOverride, THEMES } from "./_fixture-helpers";
import { FALLBACK_TEXT } from "./_stubs";
import { PageContainer } from "./pagination/PageContainer";

function setup() {
  const { plugin, tree } = createTxtPlugin(FALLBACK_TEXT.repeat(100));
  return { plugins: [plugin], tree };
}

const PHONE_PRESETS = [
  { label: "iPhone SE", w: 375, h: 667 },
  { label: "iPhone 14", w: 390, h: 844 },
  { label: "Pixel 7", w: 412, h: 915 },
  { label: "iPad Mini", w: 744, h: 1133 },
] as const;

function PageButtons() {
  const { state, dispatch } = useFolio();
  if (state.readMode !== "page") return null;

  const hasPrev = state.pageIndex > 0;
  const hasNext = state.pageCount > 0 && state.pageIndex < state.pageCount - 1;

  const btnStyle: React.CSSProperties = {
    padding: "6px 16px",
    fontSize: 13,
    cursor: "pointer",
    borderRadius: 6,
    border: "1px solid rgba(128,128,128,0.3)",
    background: "rgba(128,128,128,0.08)",
    color: "inherit",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 12px",
        borderTop: "1px solid rgba(128,128,128,0.2)",
        fontSize: 13,
      }}
    >
      <button
        type="button"
        style={{ ...btnStyle, opacity: hasPrev ? 1 : 0.3 }}
        disabled={!hasPrev}
        onClick={() =>
          dispatch({ type: "SET_PAGE", index: state.pageIndex - 1 })
        }
      >
        Prev
      </button>
      <span>
        {state.pageCount > 0
          ? `${state.pageIndex + 1} / ${state.pageCount}`
          : "..."}
      </span>
      <button
        type="button"
        style={{ ...btnStyle, opacity: hasNext ? 1 : 0.3 }}
        disabled={!hasNext}
        onClick={() =>
          dispatch({ type: "SET_PAGE", index: state.pageIndex + 1 })
        }
      >
        Next
      </button>
    </div>
  );
}

function ThemedFrame({ children }: { children: React.ReactNode }) {
  const { state } = useFolio();
  const themeStyle = THEMES[state.theme] ?? THEMES.light;
  return (
    <div
      style={{
        ...themeStyle,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
      <PageButtons />
    </div>
  );
}

function PhoneFrame({
  children,
  actions,
}: {
  children: React.ReactNode;
  actions?: FolioAction[];
}) {
  const { plugins, tree } = setup();

  const [preset, setPreset] = useState(1);
  const [width, setWidth] = useState<number>(PHONE_PRESETS[1].w);
  const [height, setHeight] = useState<number>(PHONE_PRESETS[1].h);

  const applyPreset = (idx: number) => {
    setPreset(idx);
    setWidth(PHONE_PRESETS[idx].w);
    setHeight(PHONE_PRESETS[idx].h);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        padding: 24,
        height: "100vh",
        boxSizing: "border-box",
        background: "#f0f0f0",
        overflow: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          fontSize: 13,
        }}
      >
        {PHONE_PRESETS.map((p, i) => (
          <button
            type="button"
            key={p.label}
            onClick={() => applyPreset(i)}
            style={{
              padding: "4px 10px",
              borderRadius: 4,
              border: "1px solid #ccc",
              background: preset === i ? "#333" : "#fff",
              color: preset === i ? "#fff" : "#333",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {p.label}
          </button>
        ))}
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          W
          <input
            type="range"
            min={280}
            max={1024}
            value={width}
            onChange={(e) => {
              setWidth(Number(e.target.value));
              setPreset(-1);
            }}
          />
          <span style={{ minWidth: 36, textAlign: "right" }}>{width}</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          H
          <input
            type="range"
            min={400}
            max={1400}
            value={height}
            onChange={(e) => {
              setHeight(Number(e.target.value));
              setPreset(-1);
            }}
          />
          <span style={{ minWidth: 36, textAlign: "right" }}>{height}</span>
        </label>
      </div>

      <div
        style={{
          width,
          height,
          borderRadius: 24,
          border: "3px solid #222",
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <FolioProvider tree={tree} plugins={plugins}>
          {actions && <StateOverride actions={actions} />}
          <ThemedFrame>{children}</ThemedFrame>
        </FolioProvider>
      </div>
    </div>
  );
}

function FolioContent() {
  const { state, content, registry } = useFolio();
  if (!content) return null;
  const plugin = registry.resolveRenderer(content.contentType);
  if (!plugin) return null;
  const { Renderer } = plugin;
  return (
    <div
      style={{
        height: "100%",
        padding: "24px 32px",
        fontSize: `${state.fontSize}px`,
        lineHeight: state.lineHeight,
      }}
    >
      <Renderer raw={content.raw} meta={content.meta} />
    </div>
  );
}

function InnerReader() {
  const { state } = useFolio();
  if (state.readMode === "page") {
    return (
      <PageContainer>
        <FolioContent />
      </PageContainer>
    );
  }
  return (
    <div style={{ height: "100%", overflow: "auto" }}>
      <FolioContent />
    </div>
  );
}

const meta = {
  title: "Folio/Themes",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ScrollMode: Story = {
  render: () => (
    <PhoneFrame actions={[{ type: "SET_READ_MODE", mode: "scroll" }]}>
      <InnerReader />
    </PhoneFrame>
  ),
};

export const PageMode: Story = {
  render: () => (
    <PhoneFrame>
      <InnerReader />
    </PhoneFrame>
  ),
};

export const DarkTheme: Story = {
  render: () => (
    <PhoneFrame actions={[{ type: "SET_THEME", theme: "dark" }]}>
      <InnerReader />
    </PhoneFrame>
  ),
};

export const SepiaTheme: Story = {
  render: () => (
    <PhoneFrame actions={[{ type: "SET_THEME", theme: "sepia" }]}>
      <InnerReader />
    </PhoneFrame>
  ),
};

function CompactReaderFrame({
  label,
  themeAction,
}: {
  label: string;
  themeAction: FolioAction;
}) {
  const { plugins, tree } = setup();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        flex: 1,
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 500, color: "#444" }}>
        {label}
      </div>
      <div
        style={{
          width: "100%",
          maxWidth: 280,
          height: 360,
          borderRadius: 16,
          border: "2px solid #222",
          overflow: "hidden",
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <FolioProvider tree={tree} plugins={plugins}>
          <StateOverride actions={[themeAction]} />
          <ThemedFrame>
            <PageContainer>
              <FolioContent />
            </PageContainer>
          </ThemedFrame>
        </FolioProvider>
      </div>
    </div>
  );
}

export const ThemeAxis: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Side-by-side comparison of the three reader theme palettes (light, dark, sepia) so palette drift is obvious at a glance.",
      },
    },
  },
  render: () => (
    <div
      style={{
        display: "flex",
        gap: 16,
        padding: 24,
        background: "#f0f0f0",
        alignItems: "flex-start",
        flexWrap: "wrap",
      }}
    >
      <CompactReaderFrame
        label="Light"
        themeAction={{ type: "SET_THEME", theme: "light" }}
      />
      <CompactReaderFrame
        label="Dark"
        themeAction={{ type: "SET_THEME", theme: "dark" }}
      />
      <CompactReaderFrame
        label="Sepia"
        themeAction={{ type: "SET_THEME", theme: "sepia" }}
      />
    </div>
  ),
};
