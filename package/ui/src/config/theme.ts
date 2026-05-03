import {
  createTheme,
  type Theme,
  type ThemeOptions,
} from "@mui/material/styles";
import { dynamicColorsToPalette, generateDynamicColors } from "./dynamicTheme";
import { darkColors, lightColors, type ColorTokens } from "./tokens/colors";
import {
  fontFamilies,
  fontSizes,
  fontWeights,
  lineHeights,
} from "./tokens/typography";
import { darkShadows, lightShadows } from "./tokens/elevation";
import { duration, easing } from "./tokens/motion";
import { SPACING_BASE_PX } from "./tokens/spacing";
import { RADIUS_BASE_PX } from "./tokens/radius";

declare module "@mui/material/styles" {
  interface TypeText {
    brand: string;
  }
}

const buildPalette = (
  mode: "light" | "dark",
  c: ColorTokens,
  customColor?: string,
): ThemeOptions["palette"] => ({
  mode,
  primary: {
    main: customColor || c.brand.fill,
    light: c.brand.textDark,
    dark: c.brand.fillActive,
    contrastText: c.text.onBrand,
  },
  secondary: {
    main: c.semantic.info.fill,
    light: c.semantic.info.textDark,
    dark: c.semantic.info.textLight,
    contrastText: "#ffffff",
  },
  success: {
    main: c.semantic.success.fill,
    light: c.semantic.success.textDark,
    dark: c.semantic.success.textLight,
    contrastText: "#ffffff",
  },
  warning: {
    main: c.semantic.warning.fill,
    light: c.semantic.warning.textDark,
    dark: c.semantic.warning.textLight,
    contrastText: "#ffffff",
  },
  error: {
    main: c.semantic.error.fill,
    light: c.semantic.error.textDark,
    dark: c.semantic.error.textLight,
    contrastText: "#ffffff",
  },
  info: {
    main: c.semantic.info.fill,
    light: c.semantic.info.textDark,
    dark: c.semantic.info.textLight,
    contrastText: "#ffffff",
  },
  background: {
    default: c.surface.canvas,
    paper: c.surface.base,
  },
  text: {
    primary: c.text.primary,
    secondary: c.text.secondary,
    disabled: c.text.disabled,
    brand: c.text.brand,
  },
  divider: c.border.whisper,
});

const buildTypography = (): ThemeOptions["typography"] => ({
  fontFamily: fontFamilies.sans,
  fontWeightLight: fontWeights.regular,
  fontWeightRegular: fontWeights.regular,
  fontWeightMedium: fontWeights.medium,
  fontWeightBold: fontWeights.semibold,
  h1: {
    fontSize: fontSizes["3xl"],
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.dense,
    letterSpacing: "-0.01em",
  },
  h2: {
    fontSize: fontSizes["2xl"],
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.dense,
    letterSpacing: "-0.01em",
  },
  h3: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.ui,
  },
  h4: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.ui,
  },
  h5: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.ui,
  },
  h6: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.ui,
  },
  body1: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.regular,
    lineHeight: lineHeights.body,
  },
  body2: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.regular,
    lineHeight: lineHeights.body,
  },
  subtitle1: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.ui,
  },
  subtitle2: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.ui,
  },
  caption: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.regular,
    lineHeight: lineHeights.ui,
  },
  overline: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.ui,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  button: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.ui,
    textTransform: "none",
  },
});

const buildShadows = (mode: "light" | "dark"): ThemeOptions["shadows"] => {
  const s = mode === "dark" ? darkShadows : lightShadows;
  // MUI shadows array is 25-long. Map our 4-tier scale across it; modal-tier (top) for high indices.
  const mapped: string[] = ["none"];
  for (let i = 1; i <= 24; i++) {
    if (i <= 2) mapped.push(s[1]);
    else if (i <= 6) mapped.push(s[2]);
    else if (i <= 16) mapped.push(s[3]);
    else mapped.push(s.modal);
  }
  return mapped as ThemeOptions["shadows"];
};

const getDesignTokens = (
  mode: "light" | "dark",
  customColor?: string,
): ThemeOptions => {
  const c = mode === "dark" ? darkColors : lightColors;
  return {
    palette: buildPalette(mode, c, customColor),

    typography: buildTypography(),

    shadows: buildShadows(mode),

    transitions: {
      duration: {
        shortest: parseInt(duration.fast),
        shorter: parseInt(duration.base),
        short: parseInt(duration.slow),
        standard: parseInt(duration.page),
        complex: 375,
        enteringScreen: parseInt(duration.base),
        leavingScreen: parseInt(duration.fast),
      },
      easing: {
        easeInOut: easing.inOut,
        easeOut: easing.out,
        easeIn: "cubic-bezier(0.4, 0.0, 1, 1)",
        sharp: easing.spring,
      },
    },

    components: {
      MuiLink: {
        defaultProps: {
          underline: "none",
        },
        styleOverrides: {
          root: ({ ownerState }) => ({
            ...(ownerState.color === "primary" && {
              color: "var(--rezics-color-text-brand)",
            }),
          }),
        },
      },
      MuiTypography: {
        styleOverrides: {
          root: ({ ownerState }) => ({
            ...(ownerState.color === "primary" && {
              color: "var(--rezics-color-text-brand)",
            }),
          }),
        },
      },
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: c.surface.canvas,
            color: c.text.primary,
            fontFamily: fontFamilies.sans,
            fontSize: fontSizes.base,
            lineHeight: lineHeights.body,
          },
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

    spacing: SPACING_BASE_PX,

    shape: {
      borderRadius: RADIUS_BASE_PX,
    },

    mixins: {
      toolbar: {
        minHeight: 60,

        "@media (min-width:768px)": {
          minHeight: 60,
        },
      },
    },
  };
};

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

export const lightTheme = getTheme("light");
export const darkTheme = getTheme("dark");
