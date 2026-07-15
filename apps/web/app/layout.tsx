import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { AppProviders } from "./providers";
import { getLocaleTags, getTranslation } from "@/i18n/server";

import "./styles.css";

export const metadata: Metadata = {
	title: "REZICS",
	description: "让对象、关系、讨论与知识一起生长。",
	applicationName: "REZICS",
	manifest: "/manifest.webmanifest",
	appleWebApp: {
		capable: true,
		title: "REZICS",
		statusBarStyle: "default",
	},
	icons: {
		icon: [
			{ url: "/icons/favicon.svg", sizes: "any", type: "image/svg+xml" },
			{ url: "/icons/pwa-192x192.png", sizes: "192x192", type: "image/png" },
		],
		apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
	},
};

export const viewport: Viewport = {
	colorScheme: "light dark",
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#fcfbfa" },
		{ media: "(prefers-color-scheme: dark)", color: "#171513" },
	],
	viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
	const tags = await getLocaleTags();
	const { locale } = await getTranslation(tags);
	return (
		<html lang={locale.current} suppressHydrationWarning>
			<head>
				<script
					dangerouslySetInnerHTML={{
						__html: `(function(){try{var t=localStorage.getItem('rezics-theme');var d=t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()`,
					}}
				/>
			</head>
			<body className="min-w-80">
				<AppProviders localeTags={tags}>{children}</AppProviders>
			</body>
		</html>
	);
}
