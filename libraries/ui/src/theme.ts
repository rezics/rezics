export interface AppThemeColors {
	brand: string;
	brandForeground: string;
	background: string;
	foreground: string;
	card: string;
	cardForeground: string;
	surfaceHover: string;
	surfaceSelected: string;
	surfaceContainer: string;
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
	linkHover: string;
	linkVisited: string;
	borderWeak: string;
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
		brand: "#D8404C",
		brandForeground: "#FFFFFF",
		background: "#FFFFFF",
		foreground: "#181C1F",
		card: "#FFFFFF",
		cardForeground: "#181C1F",
		surfaceHover: "#F6F8F9",
		surfaceSelected: "#E5EBEE",
		surfaceContainer: "#F6F8F9",
		popover: "#FFFFFF",
		popoverForeground: "#181C1F",
		primary: "#D8404C",
		primaryForeground: "#FFFFFF",
		secondary: "#E5EBEE",
		secondaryForeground: "#181C1F",
		muted: "#F6F8F9",
		mutedForeground: "#5C6C74",
		accent: "#EEF1F3",
		accentForeground: "#181C1F",
		destructive: "#BC0117",
		destructiveForeground: "#FFFFFF",
		info: "#115BCA",
		infoForeground: "#FFFFFF",
		success: "#016E0B",
		successForeground: "#FFFFFF",
		warning: "#B78800",
		warningForeground: "#000000",
		link: "#115BCA",
		linkHover: "#0A449B",
		linkVisited: "#9B00D4",
		borderWeak: "#00000019",
		border: "transparent",
		input: "#00000033",
		ring: "#D8404C",
		sidebar: "#F6F8F9",
		sidebarForeground: "#181C1F",
		sidebarPrimary: "#D8404C",
		sidebarPrimaryForeground: "#FFFFFF",
		sidebarAccent: "#E5EBEE",
		sidebarAccentForeground: "#181C1F",
		sidebarBorder: "#00000019",
		sidebarRing: "#D8404C",
		chart1: "#D8404C",
		chart2: "#115BCA",
		chart3: "#6A5CFF",
		chart4: "#016E0B",
		chart5: "#B78800",
	},
	dark: {
		brand: "#D8404C",
		brandForeground: "#FFFFFF",
		background: "#0E1113",
		foreground: "#EEF1F3",
		card: "#0E1113",
		cardForeground: "#EEF1F3",
		surfaceHover: "#181C1F",
		surfaceSelected: "#2A3236",
		surfaceContainer: "#181C1F",
		popover: "#21272A",
		popoverForeground: "#EEF1F3",
		primary: "#D8404C",
		primaryForeground: "#FFFFFF",
		secondary: "#2A3236",
		secondaryForeground: "#EEF1F3",
		muted: "#181C1F",
		mutedForeground: "#8BA2AD",
		accent: "#21272A",
		accentForeground: "#EEF1F3",
		destructive: "#FF4F40",
		destructiveForeground: "#000000",
		info: "#648EFC",
		infoForeground: "#0E1113",
		success: "#00C61C",
		successForeground: "#000000",
		warning: "#D8A100",
		warningForeground: "#000000",
		link: "#648EFC",
		linkHover: "#90A9FD",
		linkVisited: "#CF5FFF",
		borderWeak: "#FFFFFF19",
		border: "transparent",
		input: "#FFFFFF33",
		ring: "#D8404C",
		sidebar: "#0E1113",
		sidebarForeground: "#EEF1F3",
		sidebarPrimary: "#D8404C",
		sidebarPrimaryForeground: "#FFFFFF",
		sidebarAccent: "#181C1F",
		sidebarAccentForeground: "#EEF1F3",
		sidebarBorder: "#FFFFFF19",
		sidebarRing: "#D8404C",
		chart1: "#D8404C",
		chart2: "#648EFC",
		chart3: "#9580FF",
		chart4: "#00C61C",
		chart5: "#D8A100",
	},
} as const satisfies Readonly<Record<"light" | "dark", AppThemeColors>>;

function toCssVariable(name: string): string {
	return `--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

function createCssRule(
	selector: string,
	colorScheme: "light" | "dark",
	colors: AppThemeColors,
): string {
	const declarations = Object.entries(colors)
		.map(([name, value]) => `${toCssVariable(name)}:${value}`)
		.join(";");
	return `${selector}{color-scheme:${colorScheme};${declarations}}`;
}

export const appThemeCss = [
	createCssRule(":root", "light", appTheme.light),
	createCssRule(".dark", "dark", appTheme.dark),
].join("");
