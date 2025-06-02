import { createTheme, ThemeOptions } from '@mui/material/styles';

// 定义基础的设计 Token，可以根据需要扩展
const getDesignTokens = (mode: 'light' | 'dark'): ThemeOptions => ({
  palette: {
    mode,
    ...(mode === 'light'
      ? {
          // 亮色模式下的调色板
          primary: {
            main: '#1976d2', // Material UI 默认蓝色
          },
          background: {
            default: '#f5f5f5', // 稍亮的灰色背景
            paper: '#ffffff',   // 白色卡片背景
          },
          text: {
            primary: 'rgba(0, 0, 0, 0.87)',
            secondary: 'rgba(0, 0, 0, 0.6)',
          }
        }
      : {
          // 暗色模式下的调色板
          primary: {
            main: '#90caf9', // Material UI 亮蓝色，适合暗色背景
          },
          background: {
            default: '#121212', // 标准的暗色背景
            paper: '#1e1e1e',   // 稍亮的暗色卡片背景
          },
          text: {
            primary: '#ffffff',
            secondary: 'rgba(255, 255, 255, 0.7)',
          }
        }),
  },
  // 你可以在这里添加更多全局组件的样式覆盖
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: mode === 'dark' ? "#6b6b6b #2b2b2b" : "#c1c1c1 #f5f5f5",
          "&::-webkit-scrollbar, & *::-webkit-scrollbar": {
            backgroundColor: mode === 'dark' ? "#2b2b2b" : "#f5f5f5",
            width: '8px',
          },
          "&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb": {
            borderRadius: 8,
            backgroundColor: mode === 'dark' ? "#6b6b6b" : "#c1c1c1",
            minHeight: 24,
            border: `2px solid ${mode === 'dark' ? "#2b2b2b" : "#f5f5f5"}`,
          },
          "&::-webkit-scrollbar-thumb:focus, & *::-webkit-scrollbar-thumb:focus": {
            backgroundColor: mode === 'dark' ? "#959595" : "#a8a8a8",
          },
          "&::-webkit-scrollbar-thumb:active, & *::-webkit-scrollbar-thumb:active": {
            backgroundColor: mode === 'dark' ? "#959595" : "#a8a8a8",
          },
          "&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover": {
            backgroundColor: mode === 'dark' ? "#959595" : "#a8a8a8",
          },
        },
      },
    },
    // 可以在这里为其他MUI组件添加默认props或styleOverrides
    // MuiButton: {
    //   defaultProps: {
    //     disableElevation: true,
    //   }
    // },
    // MuiAppBar: {
    //   styleOverrides: {
    //     root: {
    //       backgroundColor: mode === 'light' ? '#1976d2' : '#1e1e1e',
    //     }
    //   }
    // }
  },
  typography: {
    // 全局字体配置 (可选)
    // fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    // h1: { fontSize: '2.2rem' },
  },
  // 其他全局主题配置, 比如 spacing, breakpoints, shape 等
});

export const getTheme = (mode: 'light' | 'dark') => {
  return createTheme(getDesignTokens(mode));
}; 