export interface AppThemeColors {
	background: string;
	foreground: string;
	card: string;
	cardForeground: string;
	popover: string;
	popoverForeground: string;
	primary: string;
	primaryForeground: string;
	secondary: string;
	secondaryForeground: string;
	muted: string;
	mutedForeground: string;
	accent: string;
	accentForeground: string;
	destructive: string;
	destructiveForeground: string;
	info: string;
	infoForeground: string;
	success: string;
	successForeground: string;
	warning: string;
	warningForeground: string;
	link: string;
	border: string;
	input: string;
	ring: string;
	sidebar: string;
	sidebarForeground: string;
	sidebarPrimary: string;
	sidebarPrimaryForeground: string;
	sidebarAccent: string;
	sidebarAccentForeground: string;
	sidebarBorder: string;
	sidebarRing: string;
	chart1: string;
	chart2: string;
	chart3: string;
	chart4: string;
	chart5: string;
}

export const appTheme = {
	light: {
		background: "#F7F4EE",
		foreground: "#18222B",
		card: "#FFFFFF",
		cardForeground: "#18222B",
		popover: "#FFFFFF",
		popoverForeground: "#18222B",
		primary: "#996314",
		primaryForeground: "#FFFFFF",
		secondary: "#E9E3D8",
		secondaryForeground: "#26303A",
		muted: "#EEEAE2",
		mutedForeground: "#5B6470",
		accent: "#F1E2C9",
		accentForeground: "#6E4309",
		destructive: "#B3261E",
		destructiveForeground: "#FFFFFF",
		info: "#147D78",
		infoForeground: "#FFFFFF",
		success: "#27734C",
		successForeground: "#FFFFFF",
		warning: "#835B0A",
		warningForeground: "#FFFFFF",
		link: "#147D78",
		border: "#D5CEC1",
		input: "#A49C8F",
		ring: "#9B6515",
		sidebar: "#FFFFFF",
		sidebarForeground: "#26303A",
		sidebarPrimary: "#9B6515",
		sidebarPrimaryForeground: "#FFFFFF",
		sidebarAccent: "#F1E2C9",
		sidebarAccentForeground: "#6E4309",
		sidebarBorder: "#D5CEC1",
		sidebarRing: "#9B6515",
		chart1: "#9B6515",
		chart2: "#147D78",
		chart3: "#6E587A",
		chart4: "#27734C",
		chart5: "#835B0A",
	},
	dark: {
		background: "#07131F",
		foreground: "#F1E4CC",
		card: "#0E1C29",
		cardForeground: "#F1E4CC",
		popover: "#132331",
		popoverForeground: "#F1E4CC",
		primary: "#D8A050",
		primaryForeground: "#1B1408",
		secondary: "#1A2B39",
		secondaryForeground: "#F1E4CC",
		muted: "#182A38",
		mutedForeground: "#B8B0A1",
		accent: "#2B251B",
		accentForeground: "#F3CF91",
		destructive: "#FF8A80",
		destructiveForeground: "#2B0808",
		info: "#5BB8B1",
		infoForeground: "#051816",
		success: "#6FC59A",
		successForeground: "#071B12",
		warning: "#E7B75A",
		warningForeground: "#241702",
		link: "#5BB8B1",
		border: "#2A3C49",
		input: "#49606F",
		ring: "#D8A050",
		sidebar: "#091723",
		sidebarForeground: "#D7CCB8",
		sidebarPrimary: "#D8A050",
		sidebarPrimaryForeground: "#1B1408",
		sidebarAccent: "#2B251B",
		sidebarAccentForeground: "#F3CF91",
		sidebarBorder: "#2A3C49",
		sidebarRing: "#D8A050",
		chart1: "#D8A050",
		chart2: "#5BB8B1",
		chart3: "#B39AD2",
		chart4: "#6FC59A",
		chart5: "#E7B75A",
	},
} as const satisfies Record<"light" | "dark", AppThemeColors>;

function toCssVariable(name: string) {
	return `--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

function createCssRule(selector: string, colorScheme: "light" | "dark", colors: AppThemeColors) {
	const declarations = Object.entries(colors)
		.map(([name, value]) => `${toCssVariable(name)}:${value}`)
		.join(";");
	return `${selector}{color-scheme:${colorScheme};${declarations}}`;
}

export const appThemeCss = [
	createCssRule(":root", "light", appTheme.light),
	createCssRule(".dark", "dark", appTheme.dark),
].join("");
