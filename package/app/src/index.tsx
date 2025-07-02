import { StrictMode, useMemo } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Router from "./router/router";
import { ThemeProvider, useMediaQuery } from "@mui/material";
import { StyledEngineProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { getTheme } from "./config/theme";
import { appStore } from "./global/appStore";
import { setupMock } from "./plugin/providers/mock";
import { client, UrqlProvider } from "./plugin/providers/urql";

const container = document.getElementById("app") as HTMLElement;
const root = createRoot(container);

function Root() {
    // const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
    // const theme = useMemo(() => getTheme(prefersDarkMode ? "dark" : "light"), [prefersDarkMode]);
    const themeMode = appStore((state) => state.theme);
    const theme = useMemo(() => getTheme(themeMode), [themeMode]);

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

await setupMock();

root.render(<Root />);
