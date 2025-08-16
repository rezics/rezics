import { StrictMode, useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Router from "./router/router.tsx";
import { ThemeProvider, useMediaQuery } from "@mui/material";
import { StyledEngineProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { getDynamicTheme, getTheme } from "./config/theme.ts";
import { appStore } from "./global/appStore.ts";
import {
	applyDynamicThemeToDOM,
	generateDynamicColors,
} from "./config/dynamicTheme.ts";
import { SWRConfig } from "swr";
import { swrOptions } from "./plugin/providers/swr.ts";
import { setupMock } from "./plugin/providers/mock.ts";

// ANCHOR I18n
import { initI18n } from "./plugin/providers/i18n.ts";
initI18n();

// ANCHOR PersistentSettings
import { PersistentSettingsLoader } from "./plugin/providers/PersistentSettingsLoader.tsx";

// ANCHOR APP root
const container = document.getElementById("app") as HTMLElement;
// 检查容器上是否已经附加了 root 实例
// 我们使用一个自定义的 _reactRoot 属性来存储它
if (!(container as any)._reactRoot) {
	// 如果没有，就创建一个新的 root 并附加到容器上
	(container as any)._reactRoot = createRoot(container);
}

// FIXME 但是我們仍然沒有找到爲什麽會有熱更新index的問題
const root = (container as any)._reactRoot;

import "github-markdown-css/github-markdown-light.css";

function Root() {
	const themeMode = appStore((state) => state.theme);
	const customColor = appStore((state) => state.customColor);
	const useDynamicTheme = appStore((state) => state.useDynamicTheme);

	const theme = useMemo(() => {
		if (useDynamicTheme && customColor) {
			// 应用动态主题到 DOM
			const dynamicColors = generateDynamicColors(
				customColor,
				themeMode === "dark",
			);
			applyDynamicThemeToDOM(dynamicColors, themeMode === "dark");
			return getDynamicTheme(themeMode, customColor);
		}
		return getTheme(themeMode);
	}, [themeMode, customColor, useDynamicTheme]);

    useEffect(() => {
        // @ts-ignore we have document in the browser
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
					<PersistentSettingsLoader />
					<SWRConfig value={swrOptions}>
						{Router}
					</SWRConfig>
				</ThemeProvider>
			</StyledEngineProvider>
		</StrictMode>
	);
}

setupMock().then(() => {
	root.render(<Root />);
});

// root.render(<Root />);
