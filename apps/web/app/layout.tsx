import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import socialCard from "@rezics/brand/social-card.png?url&no-inline";

import { AppProviders } from "./providers";
import { getLocaleTags, getTranslation } from "@/i18n/server";
import { appTheme, appThemeCss } from "@/lib/theme";

import "./styles.css";

const frontendOrigin =
	process.env.FRONTEND_URL ??
	process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",").find((origin) => origin.trim());

export const metadata: Metadata = {
	metadataBase: new URL(frontendOrigin?.trim() || "http://localhost:3000"),
	title: "REZICS",
	description: "Where objects, relationships, discussion, and knowledge grow together.",
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
	openGraph: {
		title: "REZICS",
		description: "Where works, communities, and thoughtful discussion connect.",
		images: [{ url: socialCard, width: 1200, height: 630, alt: "REZICS" }],
	},
	twitter: {
		card: "summary_large_image",
		title: "REZICS",
		description: "Where works, communities, and thoughtful discussion connect.",
		images: [socialCard],
	},
};

export const viewport: Viewport = {
	colorScheme: "light dark",
	viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
	const tags = await getLocaleTags();
	const { locale } = await getTranslation(tags);
	return (
		<html lang={locale.current} suppressHydrationWarning>
			<head>
				<style>{appThemeCss}</style>
				<meta
					content={appTheme.light.background}
					data-dark={appTheme.dark.background}
					data-light={appTheme.light.background}
					name="theme-color"
				/>
				<script
					dangerouslySetInnerHTML={{
						__html: `(function(){try{var t=localStorage.getItem('rezics-theme');var d=t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);var m=document.querySelector('meta[name="theme-color"]');if(m)m.content=d?m.dataset.dark:m.dataset.light}catch(e){}})()`,
					}}
				/>
			</head>
			<body className="min-w-80">
				<AppProviders localeTags={tags}>{children}</AppProviders>
			</body>
		</html>
	);
}
