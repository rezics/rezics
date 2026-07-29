import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { dehydrate } from "@tanstack/react-query";
import socialCard from "@rezics/brand/social-card.png?url&no-inline";
import { FontAwesomeVersion, isFontAwesomeLicense, type FontAwesomeLicense } from "@rezics/avatar";

import { getInitialAuthSession } from "@/features/auth/server/initial-session.server";
import { presentationPreferencesQueryKey } from "@/features/preferences/model/presentation-preferences";
import { getInitialPresentationPreferences } from "@/features/preferences/server/initial-presentation-preferences.server";
import { RootTranslationNamespaces } from "@/i18n/namespaces";
import { getTranslation } from "@/i18n/server";
import { AppProviders } from "@/lib/app-providers";
import { createQueryClient } from "@/lib/query-client";
import { appTheme, appThemeCss } from "@/lib/theme";

import "@/styles/global.css";

const frontendOrigin =
	process.env.FRONTEND_URL ??
	process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",").find((origin) => origin.trim());

function fontAwesomeKitCssUrl(): URL | undefined {
	const value = process.env.FONT_AWESOME_KIT_CSS_URL?.trim();
	if (!value) return undefined;
	const url = new URL(value);
	if (url.protocol !== "https:") throw new Error("FONT_AWESOME_KIT_CSS_URL must use HTTPS");
	return url;
}

function fontAwesomeKitLicense(): FontAwesomeLicense {
	const value = process.env.FONT_AWESOME_KIT_LICENSE?.trim() ?? "free";
	if (!isFontAwesomeLicense(value))
		throw new Error("FONT_AWESOME_KIT_LICENSE must be either free or pro");
	return value;
}

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
	const requestHeaders = await headers();
	const [{ locale, snapshot }, initialSession, initialPresentationPreferences] =
		await Promise.all([
			getTranslation(RootTranslationNamespaces),
			getInitialAuthSession(requestHeaders),
			getInitialPresentationPreferences(requestHeaders),
		]);
	const queryClient = createQueryClient();
	if (
		initialSession.status === "resolved" &&
		initialSession.data &&
		initialPresentationPreferences.status === "resolved" &&
		initialPresentationPreferences.data.profileId === initialSession.data.user.id
	)
		queryClient.setQueryData(
			presentationPreferencesQueryKey(initialSession.data.user.id),
			initialPresentationPreferences.data,
		);
	const dehydratedState = dehydrate(queryClient);
	const fontAwesomeCss = fontAwesomeKitCssUrl();
	const fontAwesomeLicense = fontAwesomeKitLicense();
	return (
		<html
			data-font-awesome={fontAwesomeCss ? "configured" : "unconfigured"}
			data-font-awesome-license={fontAwesomeLicense}
			data-font-awesome-version={FontAwesomeVersion}
			lang={locale.current}
			suppressHydrationWarning
		>
			<head>
				{fontAwesomeCss ? (
					<>
						<link
							crossOrigin="anonymous"
							href={fontAwesomeCss.origin}
							rel="preconnect"
						/>
						<link
							crossOrigin="anonymous"
							href={fontAwesomeCss.href}
							referrerPolicy="strict-origin-when-cross-origin"
							rel="stylesheet"
						/>
					</>
				) : null}
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
				<AppProviders
					dehydratedState={dehydratedState}
					initialSession={initialSession}
					initialTranslation={snapshot}
				>
					{children}
				</AppProviders>
			</body>
		</html>
	);
}
