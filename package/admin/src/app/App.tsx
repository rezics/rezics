import {ThemeProvider} from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import {StyledEngineProvider} from '@mui/material/styles';
import {StrictMode, useEffect, useMemo} from 'react';
import 'github-markdown-css/github-markdown-light.css';

import {getTheme} from './config/theme';
import {useAppStore} from './state/appStore';
import {PersistentSettingsLoader} from './provider/PersistentSettingsLoader';
import {ReactQueryProvider} from './provider/react-query';
import {AuthProvider} from './provider/AuthProvider';
import {ErrorBoundary} from 'react-error-boundary';
import {WindowAlert} from './component/WindowAlert';
import {HelmetProvider} from 'react-helmet-async';
import {useAppInit} from './provider/useAppInit';
import {RouterProvider} from '@tanstack/react-router';

import {router} from '@/router';

export default function App() {
  const themeMode = useAppStore(s => s.theme);

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
    return getTheme(themeMode);
  }, [themeMode]);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle('dark', themeMode === 'dark');
  }, [themeMode]);

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
