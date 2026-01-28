import { ThemeProvider } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { StyledEngineProvider } from '@mui/material/styles';
import { StrictMode, useEffect, useMemo } from 'react';
import 'github-markdown-css/github-markdown-light.css';

import {
  applyDynamicThemeToDOM,
  generateDynamicColors,
} from './config/dynamicTheme.ts';
import { getDynamicTheme, getTheme } from './config/theme.ts';
import { appStore } from './global/appStore.ts';
import { PersistentSettingsLoader } from './plugin/providers/PersistentSettingsLoader.tsx';
import { ReactQueryProvider } from './plugin/providers/react-query.tsx';
import { ErrorBoundary } from 'react-error-boundary';
import { WindowAlert } from './component/Common/Overlay/WindowAlert.tsx';
import { HelpFab } from './component/Common/UI/Button/HelpWidget.tsx';
import { HelmetProvider } from 'react-helmet-async';
import { useAppInit } from './plugin/providers/useAppInit.ts';
import { RouterProvider } from '@tanstack/react-router';

import { router } from './router.tsx';

export default function App() {
  const themeMode = appStore(s => s.theme);
  const customColor = appStore(s => s.customColor);
  const useDynamicTheme = appStore(s => s.useDynamicTheme);

  // ANCHOR 非常好用的Hook，回头看看封装一下
  // useEffect(() => {
  //   const onScroll = () => {
  //     const ae = document.activeElement as HTMLElement | null
  //     console.log('scrollY=', window.scrollY, 'active=', ae?.tagName, ae?.id, ae?.className)
  //   }
  //   window.addEventListener('scroll', onScroll, { passive: true })
  //   return () => window.removeEventListener('scroll', onScroll)
  // }, [])

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
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <StrictMode>
        <HelmetProvider>
          <StyledEngineProvider injectFirst>
            <ThemeProvider theme={theme}>
              <CssBaseline />
              <PersistentSettingsLoader />
              <ReactQueryProvider>
                <RouterProvider router={router} />
                <WindowAlert />
                <HelpFab />
              </ReactQueryProvider>
            </ThemeProvider>
          </StyledEngineProvider>
        </HelmetProvider>
      </StrictMode>
    </ErrorBoundary >
  );
}
