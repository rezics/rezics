import {ThemeProvider} from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import {StyledEngineProvider} from '@mui/material/styles';
import {StrictMode, useEffect, useMemo, type ReactNode} from 'react';

import {
  applyDynamicThemeToDOM,
  generateDynamicColors,
} from './config/dynamicTheme';
import {getDynamicTheme, getTheme} from './config/theme';
import {useAppStore} from './state/appStore';
import {PersistentSettingsLoader} from './provider/PersistentSettingsLoader';
import {ReactQueryProvider} from './provider/ReactQueryProvider';
import {ErrorBoundary} from 'react-error-boundary';
import {HelmetProvider} from 'react-helmet-async';
import {useAppInit} from './hook/useAppInit';

import 'virtual:uno.css';
import '@rezics/ui/shared/style/layers.css';
import './global.css';

export interface AppShellProps {
  children: ReactNode;
  /** Feature-layer slots injected between ReactQueryProvider and children */
  features?: ReactNode;
  /** Custom error fallback for ErrorBoundary */
  errorFallback?: ReactNode;
  /** Skip PersistentSettingsLoader if not needed */
  persistentSettings?: boolean;
}

export function AppShell({
  children,
  features,
  errorFallback = <div>Something went wrong</div>,
  persistentSettings = true,
}: AppShellProps) {
  const themeMode = useAppStore(s => s.theme);
  const customColor = useAppStore(s => s.customColor);
  const useDynamicTheme = useAppStore(s => s.useDynamicTheme);

  useAppInit();

  const theme = useMemo(() => {
    if (useDynamicTheme && customColor) {
      return getDynamicTheme(themeMode, customColor);
    }
    return getTheme(themeMode, customColor);
  }, [themeMode, customColor, useDynamicTheme]);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle('dark', themeMode === 'dark');

    if (useDynamicTheme && customColor) {
      const dynamicColors = generateDynamicColors(
        customColor,
        themeMode === 'dark',
      );
      applyDynamicThemeToDOM(dynamicColors, themeMode === 'dark');
    }
  }, [themeMode, customColor, useDynamicTheme]);

  return (
    <StrictMode>
      <ErrorBoundary fallback={errorFallback}>
        <HelmetProvider>
          <StyledEngineProvider injectFirst>
            <ThemeProvider theme={theme}>
              <CssBaseline />
              {persistentSettings && <PersistentSettingsLoader />}
              <ReactQueryProvider>
                {features}
                {children}
              </ReactQueryProvider>
            </ThemeProvider>
          </StyledEngineProvider>
        </HelmetProvider>
      </ErrorBoundary>
    </StrictMode>
  );
}
