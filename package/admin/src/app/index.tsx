import {CssBaseline} from '@mui/material';
import {ThemeProvider} from '@mui/material/styles';
import React from 'react';
import ReactDOM from 'react-dom/client';

import 'github-markdown-css/github-markdown-light.css';

import {getTheme} from '@/config/theme';
import {ReactQueryProvider} from '@/plugin/providers/react-query';
import {useAppInit} from '@/plugin/providers/useAppInit';
import {RouterProvider} from '@tanstack/react-router';

import {router} from './router.tsx';

export function Bootstrap() {
  useAppInit();
  return <RouterProvider router={router} />;
}

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <ThemeProvider theme={getTheme('light')}>
      <CssBaseline />
      <ReactQueryProvider>
        <Bootstrap />
      </ReactQueryProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
