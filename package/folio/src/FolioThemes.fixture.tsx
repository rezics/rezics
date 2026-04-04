import { useState } from 'react';
import { createTxtPlugin } from '@rezics/folio/plugin/txt';
import { useFolio, FolioProvider } from '@rezics/folio';
import type { FolioAction } from '@rezics/folio';
import { PageContainer } from './pagination/PageContainer';
import { FALLBACK_TEXT } from './_stubs';
import { StateOverride, THEMES } from './_fixture-helpers';

function setup() {
  const { plugin, tree } = createTxtPlugin(FALLBACK_TEXT.repeat(100));
  return { plugins: [plugin], tree };
}

// ---------------------------------------------------------------------------
// Phone frame with resizable dimensions and page-turn buttons
// ---------------------------------------------------------------------------

const PHONE_PRESETS = [
  { label: 'iPhone SE', w: 375, h: 667 },
  { label: 'iPhone 14', w: 390, h: 844 },
  { label: 'Pixel 7', w: 412, h: 915 },
  { label: 'iPad Mini', w: 744, h: 1133 },
] as const;

function PageButtons() {
  const { state, dispatch } = useFolio();
  if (state.readMode !== 'page') return null;

  const hasPrev = state.pageIndex > 0;
  const hasNext = state.pageCount > 0 && state.pageIndex < state.pageCount - 1;

  const btnStyle: React.CSSProperties = {
    padding: '6px 16px',
    fontSize: 13,
    cursor: 'pointer',
    borderRadius: 6,
    border: '1px solid rgba(128,128,128,0.3)',
    background: 'rgba(128,128,128,0.08)',
    color: 'inherit',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        borderTop: '1px solid rgba(128,128,128,0.2)',
        fontSize: 13,
      }}
    >
      <button
        style={{ ...btnStyle, opacity: hasPrev ? 1 : 0.3 }}
        disabled={!hasPrev}
        onClick={() =>
          dispatch({ type: 'SET_PAGE', index: state.pageIndex - 1 })
        }
      >
        Prev
      </button>
      <span>
        {state.pageCount > 0
          ? `${state.pageIndex + 1} / ${state.pageCount}`
          : '...'}
      </span>
      <button
        style={{ ...btnStyle, opacity: hasNext ? 1 : 0.3 }}
        disabled={!hasNext}
        onClick={() =>
          dispatch({ type: 'SET_PAGE', index: state.pageIndex + 1 })
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
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
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
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        padding: 24,
        height: '100vh',
        boxSizing: 'border-box',
        background: '#f0f0f0',
        overflow: 'auto',
      }}
    >
      {/* Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          fontSize: 13,
        }}
      >
        {PHONE_PRESETS.map((p, i) => (
          <button
            key={p.label}
            onClick={() => applyPreset(i)}
            style={{
              padding: '4px 10px',
              borderRadius: 4,
              border: '1px solid #ccc',
              background: preset === i ? '#333' : '#fff',
              color: preset === i ? '#fff' : '#333',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {p.label}
          </button>
        ))}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
          <span style={{ minWidth: 36, textAlign: 'right' }}>{width}</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
          <span style={{ minWidth: 36, textAlign: 'right' }}>{height}</span>
        </label>
      </div>

      {/* Phone bezel */}
      <div
        style={{
          width,
          height,
          borderRadius: 24,
          border: '3px solid #222',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function FolioContent() {
  const { state, content, registry } = useFolio();
  if (!content) return null;
  const plugin = registry.resolveRenderer(content.contentType);
  if (!plugin) return null;
  const { Renderer } = plugin;
  return (
    <div
      style={{
        height: '100%',
        padding: '24px 32px',
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
  if (state.readMode === 'page') {
    return (
      <PageContainer>
        <FolioContent />
      </PageContainer>
    );
  }
  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <FolioContent />
    </div>
  );
}

function ScrollMode() {
  return (
    <PhoneFrame actions={[{ type: 'SET_READ_MODE', mode: 'scroll' }]}>
      <InnerReader />
    </PhoneFrame>
  );
}

function PageMode() {
  return (
    <PhoneFrame>
      <InnerReader />
    </PhoneFrame>
  );
}

function DarkTheme() {
  return (
    <PhoneFrame actions={[{ type: 'SET_THEME', theme: 'dark' }]}>
      <InnerReader />
    </PhoneFrame>
  );
}

function SepiaTheme() {
  return (
    <PhoneFrame actions={[{ type: 'SET_THEME', theme: 'sepia' }]}>
      <InnerReader />
    </PhoneFrame>
  );
}

export default { ScrollMode, PageMode, DarkTheme, SepiaTheme };
