import type { ReactNode } from "react";
import { Head } from "vike-react/Head";
import { useConfig } from "vike-react/useConfig";
import { useData } from "vike-react/useData";

import { GlobalFooter } from "../src/components/products/GlobalFooter";
import { GlobalHeader } from "../src/components/products/GlobalHeader";
import { getLocaleContent } from "../src/content/locales";
import { ABOUT_LOCALE_META, ABOUT_SITE_ORIGIN, DEFAULT_LOCALE } from "../src/i18n/locales";
import type { AboutPageData } from "../src/pageData";

import "@rezics/ui/styles.css";
import "../src/styles/site.css";

const initialThemeScript = `(function(){try{var saved=localStorage.getItem("rezics-theme");var dark=saved==="dark"||(saved!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark);}catch{}})();`;
const notoSansTcStylesheet =
	"https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700;800;900&display=swap";

export default function Layout({ children }: { readonly children: ReactNode }) {
	const data = useData<AboutPageData>();
	const setConfig = useConfig();
	const locale = data.kind === "root" ? DEFAULT_LOCALE : data.locale;
	const meta = data.metadata;
	const copy = getLocaleContent(locale).common;
	const canonical = new URL(meta.canonicalPath, ABOUT_SITE_ORIGIN).toString();

	setConfig({
		title: meta.title,
		description: meta.description,
		lang: ABOUT_LOCALE_META[locale].htmlLang,
	});

	return (
		<>
			<Head>
				<link href="https://fonts.googleapis.com" rel="preconnect" />
				<link crossOrigin="anonymous" href="https://fonts.gstatic.com" rel="preconnect" />
				<link href={notoSansTcStylesheet} rel="stylesheet" />
				<meta name="color-scheme" content="light dark" />
				<script dangerouslySetInnerHTML={{ __html: initialThemeScript }} />
				<link rel="canonical" href={canonical} />
				<link
					rel="alternate"
					hrefLang={ABOUT_LOCALE_META[locale].htmlLang}
					href={canonical}
				/>
				<link rel="alternate" hrefLang="x-default" href={canonical} />
				<meta property="og:type" content="website" />
				<meta property="og:url" content={canonical} />
				<meta property="og:site_name" content={copy.siteName} />
				<meta property="og:title" content={meta.title} />
				<meta property="og:description" content={meta.description} />
				<meta name="twitter:card" content="summary" />
				{meta.jsonLd ? (
					<script
						type="application/ld+json"
						dangerouslySetInnerHTML={{ __html: JSON.stringify(meta.jsonLd) }}
					/>
				) : null}
			</Head>
			{data.kind === "root" ? (
				children
			) : (
				<>
					<GlobalHeader
						locale={locale}
						copy={copy}
						active={
							data.kind === "home"
								? "home"
								: data.kind === "products" || data.kind === "product"
									? "products"
									: undefined
						}
						alternatePathByLocale={meta.alternates}
					/>
					<main id="main-content">{children}</main>
					<GlobalFooter locale={locale} />
				</>
			)}
		</>
	);
}
