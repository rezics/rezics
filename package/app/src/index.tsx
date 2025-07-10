import { StrictMode, useMemo } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Router from "./router/router";
import { ThemeProvider, useMediaQuery } from "@mui/material";
import { StyledEngineProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { getTheme, getDynamicTheme } from "./config/theme";
import { appStore } from "./global/appStore";
import { applyDynamicThemeToDOM, generateDynamicColors } from "./config/dynamicTheme";


const container = document.getElementById("app") as HTMLElement;
const root = createRoot(container);

import "github-markdown-css/github-markdown-light.css";

function Root() {
    const themeMode = appStore((state) => state.theme);
    const customColor = appStore((state) => state.customColor);
    const useDynamicTheme = appStore((state) => state.useDynamicTheme);
    
    const theme = useMemo(() => {
        if (useDynamicTheme && customColor) {
            // 应用动态主题到 DOM
            const dynamicColors = generateDynamicColors(customColor, themeMode === "dark");
            applyDynamicThemeToDOM(dynamicColors, themeMode === "dark");
            return getDynamicTheme(themeMode, customColor);
        }
        return getTheme(themeMode);
    }, [themeMode, customColor, useDynamicTheme]);

    return (
        <StrictMode>
            <StyledEngineProvider injectFirst>
                <ThemeProvider theme={theme}>
                    <CssBaseline />
                    {Router}
                </ThemeProvider>
            </StyledEngineProvider>
        </StrictMode>
    );
}

root.render(<Root />);
