// 定义基础的设计 Token，可以根据需要扩展
import {
  createTheme,
  PaletteOptions,
  responsiveFontSizes,
  Theme,
  ThemeOptions,
} from '@mui/material/styles';
import {
  DynamicColorScheme,
  dynamicColorsToPalette,
  generateDynamicColors,
} from './dynamicTheme';

/**
 * 根据 mode（'light' | 'dark'）返回对应的颜色、组件覆盖等设计 Token
 */
const getDesignTokens = (
  mode: 'light' | 'dark',
  customColor?: string,
): ThemeOptions => ({
  palette: {
    mode,
    ...(mode === 'light'
      ? {
          // 亮色模式下的调色板
          primary: {
            main: customColor || '#f4606c', // 自定义的主色
            light: 'rgba(244, 96, 108, 0.8)',
            dark: 'rgba(244, 96, 108, 1)',
            contrastText: '#ffffff',
          },
          secondary: {
            main: '#1976d2',
            light: 'rgba(25, 118, 210, 0.8)',
            dark: 'rgba(25, 118, 210, 1)',
            contrastText: '#ffffff',
          },
          background: {
            default: '#f5f5f5', // 整体背景
            paper: '#ffffff', // 卡片 / surface 背景
          },
          text: {
            primary: 'rgba(0, 0, 0, 0.87)', // 主文本
            secondary: 'rgba(0, 0, 0, 0.6)', // 次级文本
            disabled: 'rgba(0, 0, 0, 0.38)',
          },
        }
      : {
          // 暗色模式下的调色板
          primary: {
            main: customColor || '#f4606c', // 自定义的主色
            light: 'rgba(244, 96, 108, 0.8)',
            dark: 'rgba(244, 96, 108, 1)',
            contrastText: '#ffffff',
          },
          secondary: {
            main: '#1976d2',
            light: 'rgba(25, 118, 210, 0.8)',
            dark: 'rgba(25, 118, 210, 1)',
            contrastText: '#ffffff',
          },
          background: {
            default: '#121212',
            paper: '#1e1e1e',
          },
          text: {
            primary: '#ffffff',
            secondary: 'rgba(255, 255, 255, 0.7)',
            disabled: 'rgba(255, 255, 255, 0.5)',
          },
        }),
  },

  // 配置全局组件默认 props / 样式覆写
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor:
            mode === 'dark' ? '#6b6b6b #2b2b2b' : '#c1c1c1 #f5f5f5',
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
            backgroundColor: mode === 'dark' ? '#2b2b2b' : '#f5f5f5',
            width: '8px',
          },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
            borderRadius: 8,
            backgroundColor: mode === 'dark' ? '#6b6b6b' : '#c1c1c1',
            minHeight: 24,
            border: `2px solid ${mode === 'dark' ? '#2b2b2b' : '#f5f5f5'}`,
          },
          '&::-webkit-scrollbar-thumb:focus, & *::-webkit-scrollbar-thumb:focus':
            {
              backgroundColor: mode === 'dark' ? '#959595' : '#a8a8a8',
            },
          '&::-webkit-scrollbar-thumb:active, & *::-webkit-scrollbar-thumb:active':
            {
              backgroundColor: mode === 'dark' ? '#959595' : '#a8a8a8',
            },
          '&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover':
            {
              backgroundColor: mode === 'dark' ? '#959595' : '#a8a8a8',
            },
        },
      },
    },
    // 示例：全局修改 Button 的默认属性
    MuiButton: {
      defaultProps: {
        disableElevation: true,
        variant: 'contained',
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
        },
      },
    },
    // 示例：自定义 AppBar 背景色随模式切换
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: mode === 'light' ? '#f4606c' : '#f4606c',
        },
      },
    },
  },

  typography: {
    // 全局字体设置
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 700,
      lineHeight: 1.3,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.5,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 500,
      lineHeight: 1.6,
    },
    body1: {
      fontSize: '1rem',
      fontWeight: 400,
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      fontWeight: 400,
      lineHeight: 1.5,
    },
    subtitle1: {
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: 1.75,
    },
    subtitle2: {
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: 1.57,
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 600,
      lineHeight: 1.75,
    },
    caption: {
      fontSize: '0.75rem',
      fontWeight: 400,
      lineHeight: 1.66,
    },
    overline: {
      fontSize: '0.75rem',
      fontWeight: 400,
      lineHeight: 2.66,
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
    },
  },

  // 剩余的常用全局配置项
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },

  spacing: 8, // spacing(1) = 8px

  shape: {
    borderRadius: 8, // 全局圆角
  },
});

/**
 * 使用动态颜色生成主题
 */
export const getDynamicTheme = (
  mode: 'light' | 'dark',
  sourceColor?: string,
): Theme => {
  if (!sourceColor) {
    return createTheme({...getDesignTokens(mode), cssVariables: true});
  }

  // 生成动态颜色方案
  const dynamicColors = generateDynamicColors(sourceColor, mode === 'dark');
  const dynamicPalette = dynamicColorsToPalette(dynamicColors, mode);

  // 合并动态调色板和基础设计 token
  const baseTokens = getDesignTokens(mode);
  const enhancedTokens: ThemeOptions = {
    ...baseTokens,
    palette: {
      ...baseTokens.palette,
      ...dynamicPalette,
    },
    // 更新组件样式以使用动态颜色
    components: {
      ...baseTokens.components,
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: dynamicColors.primary,
            color: dynamicColors.onPrimary,
          },
        },
      },
    },
  };

  return createTheme({...enhancedTokens, cssVariables: true});
};

/**
 * getTheme 每次调用都 new 一个全新的 Theme
 */
export const getTheme = (
  mode: 'light' | 'dark',
  customColor?: string,
): Theme => {
  return createTheme({
    ...getDesignTokens(mode, customColor),
    cssVariables: true,
  });
};
