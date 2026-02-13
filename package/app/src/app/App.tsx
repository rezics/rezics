import {ThemeProvider} from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import {StyledEngineProvider} from '@mui/material/styles';
import {StrictMode, useEffect, useMemo} from 'react';
import 'github-markdown-css/github-markdown-light.css';

import {
  applyDynamicThemeToDOM,
  generateDynamicColors,
} from './config/dynamicTheme.ts';
import {getDynamicTheme, getTheme} from './config/theme.ts';
import {useAppStore} from '@/global/appStore.ts';
import {PersistentSettingsLoader} from './provider/PersistentSettingsLoader.tsx';
import {ReactQueryProvider} from './provider/react-query.tsx';
import {AuthProvider} from './provider/AuthProvider.tsx';
import {ErrorBoundary} from 'react-error-boundary';
import {WindowAlert} from './component/WindowAlert.tsx';
import {HelmetProvider} from 'react-helmet-async';
import {useAppInit} from './provider/useAppInit.ts';
import {RouterProvider} from '@tanstack/react-router';

import {router} from '@/router.tsx';

export default function App() {
  const themeMode = useAppStore(s => s.theme);
  const customColor = useAppStore(s => s.customColor);
  const useDynamicTheme = useAppStore(s => s.useDynamicTheme);

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
    <StrictMode>
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        {/* TODO ErrorBoundary 的作用是什么？ */}
        <HelmetProvider>
          <StyledEngineProvider injectFirst>
            <ThemeProvider theme={theme}>
              <CssBaseline />
              <PersistentSettingsLoader />
              <ReactQueryProvider>
                <AuthProvider />
                <RouterProvider router={router} />
                <WindowAlert />
              </ReactQueryProvider>
            </ThemeProvider>
          </StyledEngineProvider>
        </HelmetProvider>
      </ErrorBoundary>
    </StrictMode>
  );
}
