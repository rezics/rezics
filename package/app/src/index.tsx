import { StrictMode, useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Router from "./router/router";
import { ThemeProvider, useMediaQuery } from "@mui/material";
import { StyledEngineProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { getTheme, getDynamicTheme } from "./config/theme";
import { appStore } from "./global/appStore";
import { applyDynamicThemeToDOM, generateDynamicColors } from "./config/dynamicTheme";
import { setupMock } from "./plugin/providers/mock";
import { client, UrqlProvider } from "./plugin/providers/urql";

import { initI18n } from "./plugin/providers/i18n";

initI18n();

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

    useEffect(() => {
        const root = document.documentElement;

        if (themeMode === "dark") {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
    }, [themeMode]);

    return (
        <StrictMode>
            <StyledEngineProvider injectFirst>
                <ThemeProvider theme={theme}>
                    <CssBaseline />
                    <UrqlProvider value={client}>{Router}</UrqlProvider>
                </ThemeProvider>
            </StyledEngineProvider>
        </StrictMode>
    );
}

setupMock().then(() => {
    root.render(<Root />);
});
