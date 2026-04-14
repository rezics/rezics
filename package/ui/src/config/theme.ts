import {
  createTheme,
  type Theme,
  type ThemeOptions,
} from "@mui/material/styles";
import { dynamicColorsToPalette, generateDynamicColors } from "./dynamicTheme";

const getDesignTokens = (
  mode: "light" | "dark",
  customColor?: string,
): ThemeOptions => ({
  palette: {
    mode,
    ...(mode === "light"
      ? {
          primary: {
            main: customColor || "#f4606c",
            light: "rgba(244, 96, 108, 0.8)",
            dark: "rgba(244, 96, 108, 1)",
            contrastText: "#ffffff",
          },
          secondary: {
            main: "#1976d2",
            light: "rgba(25, 118, 210, 0.8)",
            dark: "rgba(25, 118, 210, 1)",
            contrastText: "#ffffff",
          },
          background: {
            default: "#f5f5f5",
            paper: "#ffffff",
          },
          text: {
            primary: "rgba(0, 0, 0, 0.87)",
            secondary: "rgba(0, 0, 0, 0.6)",
            disabled: "rgba(0, 0, 0, 0.38)",
          },
        }
      : {
          primary: {
            main: customColor || "#f4606c",
            light: "rgba(244, 96, 108, 0.8)",
            dark: "rgba(244, 96, 108, 1)",
            contrastText: "#ffffff",
          },
          secondary: {
            main: "#1976d2",
            light: "rgba(25, 118, 210, 0.8)",
            dark: "rgba(25, 118, 210, 1)",
            contrastText: "#ffffff",
          },
          background: {
            default: "#121212",
            paper: "#1e1e1e",
          },
          text: {
            primary: "#ffffff",
            secondary: "rgba(255, 255, 255, 0.7)",
            disabled: "rgba(255, 255, 255, 0.5)",
          },
        }),
  },

  components: {
    MuiLink: {
      defaultProps: {
        underline: "none",
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
        variant: "contained",
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

  spacing: 8,

  shape: {
    borderRadius: 8,
  },

  mixins: {
    toolbar: {
      minHeight: 60,

      "@media (min-width:768px)": {
        minHeight: 60,
      },
    },
  },
});

export const getDynamicTheme = (
  mode: "light" | "dark",
  sourceColor?: string,
): Theme => {
  if (!sourceColor) {
    return createTheme({ ...getDesignTokens(mode), cssVariables: true });
  }

  const dynamicColors = generateDynamicColors(sourceColor, mode === "dark");
  const dynamicPalette = dynamicColorsToPalette(dynamicColors, mode);

  const baseTokens = getDesignTokens(mode);
  const enhancedTokens: ThemeOptions = {
    ...baseTokens,
    palette: {
      ...baseTokens.palette,
      ...dynamicPalette,
    },
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

  return createTheme({ ...enhancedTokens, cssVariables: true });
};

export const getTheme = (
  mode: "light" | "dark",
  customColor?: string,
): Theme => {
  return createTheme({
    ...getDesignTokens(mode, customColor),
    cssVariables: true,
  });
};
