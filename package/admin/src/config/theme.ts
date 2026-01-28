import {createTheme} from '@mui/material/styles';
import type {Theme} from '@mui/material/styles';

export type AdminThemeMode = 'light' | 'dark';

export function getTheme(mode: AdminThemeMode): Theme {
  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#1565c0',
      },
      background:
        mode === 'dark'
          ? {default: '#0b1220', paper: '#111a2e'}
          : {default: '#f6f7fb', paper: '#ffffff'},
    },
    shape: {
      borderRadius: 10,
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    },
    components: {
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 10,
          },
        },
      },
    },
  });
}

