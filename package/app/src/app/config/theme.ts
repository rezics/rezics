// 定义基础的设计 Token，可以根据需要扩展
import {createTheme, type Theme, type ThemeOptions} from '@mui/material/styles';
import {dynamicColorsToPalette, generateDynamicColors} from './dynamicTheme';

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
    MuiLink: {
      defaultProps: {
        underline: 'none',
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {},
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
        variant: 'contained',
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {},
      },
    },
  },

  breakpoints: {
    values: {
      xs: 0,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
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
