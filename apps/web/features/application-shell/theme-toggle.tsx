"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@rezics/ui";

import { useTranslation } from "@/i18n/client";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = Exclude<Theme, "system">;

function resolveTheme(theme: Theme): ResolvedTheme {
	return theme === "system"
		? window.matchMedia("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light"
		: theme;
}

function applyTheme(theme: ResolvedTheme) {
	document.documentElement.classList.toggle("dark", theme === "dark");
	const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
	const color = themeColor?.dataset[theme];
	if (themeColor && color) themeColor.content = color;
}

export function ThemeToggle() {
	const { t } = useTranslation(["locale"]);
	const [theme, setTheme] = useState<Theme>("system");
	const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
	const [ready, setReady] = useState(false);

	useEffect(() => {
		const saved = localStorage.getItem("rezics-theme");
		const initial = saved === "light" || saved === "dark" ? saved : "system";
		setTheme(initial);
		setReady(true);
	}, []);

	useEffect(() => {
		if (!ready) return;
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => {
			const next = resolveTheme(theme);
			applyTheme(next);
			setResolvedTheme(next);
		};
		onChange();
		if (theme !== "system") return;
		media.addEventListener("change", onChange);
		return () => media.removeEventListener("change", onChange);
	}, [ready, theme]);

	const dark = ready && resolvedTheme === "dark";
	return (
		<Button
			aria-label={dark ? t.locale.useLightTheme : t.locale.useDarkTheme}
			className="size-11"
			onClick={() => {
				const next: ResolvedTheme = resolvedTheme === "dark" ? "light" : "dark";
				localStorage.setItem("rezics-theme", next);
				setTheme(next);
			}}
			size="icon-xl"
			variant="ghost"
		>
			{dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
		</Button>
	);
}
