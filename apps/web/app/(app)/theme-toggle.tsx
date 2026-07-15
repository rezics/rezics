"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@rezics/ui";

type Theme = "light" | "dark" | "system";

function resolveTheme(theme: Theme) {
	return theme === "system"
		? window.matchMedia("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light"
		: theme;
}

export function ThemeToggle() {
	const [theme, setTheme] = useState<Theme>("system");
	const [ready, setReady] = useState(false);

	useEffect(() => {
		const saved = localStorage.getItem("rezics-theme");
		const initial = saved === "light" || saved === "dark" ? saved : "system";
		setTheme(initial);
		document.documentElement.classList.toggle("dark", resolveTheme(initial) === "dark");
		setReady(true);
	}, []);

	const dark = ready && resolveTheme(theme) === "dark";
	return (
		<Button
			aria-label={dark ? "Use light theme" : "Use dark theme"}
			onClick={() => {
				const next: Theme = resolveTheme(theme) === "dark" ? "light" : "dark";
				localStorage.setItem("rezics-theme", next);
				document.documentElement.classList.toggle("dark", next === "dark");
				setTheme(next);
			}}
			size="icon-sm"
			variant="ghost"
		>
			{dark ? (
				<Sun aria-hidden className="size-4" />
			) : (
				<Moon aria-hidden className="size-4" />
			)}
		</Button>
	);
}
