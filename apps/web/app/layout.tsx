import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import socialCard from "@rezics/brand/social-card.png?url&no-inline";

import { AppProviders } from "@/lib/app-providers";
import { RootTranslationNamespaces } from "@/i18n/namespaces";
import { getTranslation } from "@/i18n/server";
import { appTheme, appThemeCss } from "@/lib/theme";

import "@/styles/global.css";

const frontendOrigin =
	process.env.FRONTEND_URL ??
	process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",").find((origin) => origin.trim());

export async function generateMetadata(): Promise<Metadata> {
	const { t } = await getTranslation(["brand"]);
	return {
		metadataBase: new URL(frontendOrigin?.trim() || "http://localhost:3000"),
		title: t.brand.name,
		description: t.brand.description,
		applicationName: t.brand.name,
		manifest: "/manifest.webmanifest",
		appleWebApp: {
			capable: true,
			title: t.brand.name,
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
			title: t.brand.name,
			description: t.brand.socialDescription,
			images: [{ url: socialCard, width: 1200, height: 630, alt: t.brand.name }],
		},
		twitter: {
			card: "summary_large_image",
			title: t.brand.name,
			description: t.brand.socialDescription,
			images: [socialCard],
		},
	};
}

export const viewport: Viewport = {
	colorScheme: "light dark",
	viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
	const { locale, snapshot } = await getTranslation(RootTranslationNamespaces);
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
						__html: `(function(){try{var t=localStorage.getItem('rezics-theme');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);var m=document.querySelector('meta[name="theme-color"]');if(m)m.content=d?m.dataset.dark:m.dataset.light}catch(e){}})()`,
					}}
				/>
			</head>
			<body className="min-w-80">
				<AppProviders initialTranslation={snapshot}>{children}</AppProviders>
			</body>
		</html>
	);
}
