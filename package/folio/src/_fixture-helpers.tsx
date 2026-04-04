import { useState, useEffect, useCallback, type ChangeEvent } from 'react';
import {
  FolioProvider,
  useFolio,
  type FolioAction,
  type FolioNode,
  type RendererPlugin,
} from '@rezics/folio';
import { WRAPPER_STYLE } from './_stubs';

// ---------------------------------------------------------------------------
// File upload hook
// ---------------------------------------------------------------------------

export function useFileUpload(accept: string) {
  const [file, setFile] = useState<File | null>(null);

  const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
  }, []);

  const reset = useCallback(() => setFile(null), []);

  function FileInput() {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 12,
          color: '#666',
          fontSize: 14,
        }}
      >
        <div>Select a file to open</div>
        <input type="file" accept={accept} onChange={onChange} />
      </div>
    );
  }

  return { file, FileInput, reset };
}

// ---------------------------------------------------------------------------
// Theme styles (mirrors THEME_STYLES from styles/theme.ts)
// ---------------------------------------------------------------------------

export const THEMES: Record<string, React.CSSProperties> = {
  light: { background: '#ffffff', color: '#1a1a1a' },
  dark: { background: '#1a1a1a', color: '#e0e0e0' },
  sepia: { background: '#f4ecd8', color: '#5b4636' },
};

// ---------------------------------------------------------------------------
// StateOverride — dispatches actions on mount inside FolioProvider
// ---------------------------------------------------------------------------

export function StateOverride({ actions }: { actions: FolioAction[] }) {
  const { dispatch } = useFolio();
  useEffect(() => {
    for (const action of actions) dispatch(action);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// ---------------------------------------------------------------------------
// FixtureReader — minimal reader surface using public APIs
// ---------------------------------------------------------------------------

export function FixtureReader() {
  const { state, content, registry } = useFolio();
  const themeStyle = THEMES[state.theme] ?? THEMES.light;

  if (state.status.state === 'loading') {
    return (
      <div
        style={{
          ...themeStyle,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Loading...
      </div>
    );
  }

  if (state.status.state === 'error') {
    return (
      <div
        style={{
          ...themeStyle,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Error: {state.status.error.message}
      </div>
    );
  }

  if (!content) {
    return <div style={{ ...themeStyle, height: '100%' }} />;
  }

  const plugin = registry.resolveRenderer(content.contentType);
  if (!plugin) {
    return (
      <div style={{ ...themeStyle, padding: 24 }}>
        No renderer available for content type: {content.contentType}
      </div>
    );
  }

  const { Renderer } = plugin;

  return (
    <div
      style={{
        ...themeStyle,
        height: '100%',
        padding: '24px 32px',
        fontSize: `${state.fontSize}px`,
        lineHeight: state.lineHeight,
        overflow: 'auto',
      }}
    >
      <Renderer raw={content.raw} meta={content.meta} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// FixtureShell — FolioProvider + FixtureReader with optional overrides
// ---------------------------------------------------------------------------

export function FixtureShell({
  tree,
  plugins,
  actions,
}: {
  tree: FolioNode[];
  plugins: RendererPlugin[];
  actions?: FolioAction[];
}) {
  return (
    <div style={WRAPPER_STYLE}>
      <FolioProvider tree={tree} plugins={plugins}>
        {actions && <StateOverride actions={actions} />}
        <FixtureReader />
      </FolioProvider>
    </div>
  );
}
