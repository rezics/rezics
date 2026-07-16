import { MDXProvider } from "@mdx-js/react";
import { useEffect, type ReactNode } from "react";
import { Head } from "vike-react/Head";
import { useConfig } from "vike-react/useConfig";
import { useData } from "vike-react/useData";
import { GlobalFooter } from "../src/components/products/GlobalFooter";
import { GlobalHeader } from "../src/components/products/GlobalHeader";
import { getLocaleContent } from "../src/content/locales";
import { ABOUT_LOCALE_META, ABOUT_SITE_ORIGIN, DEFAULT_LOCALE } from "../src/i18n/locales";
import { mdxComponents } from "../src/mdxComponents";
import type { AboutPageData } from "../src/pageData";
import { useReveal } from "../src/hooks/useReveal";
import "../src/styles/site.css";
import "../src/styles/products.css";

const themeScript =
	"(function(){try{var t=localStorage.getItem('rezics-theme');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}})()";

export default function Layout({ children }: { children: ReactNode }) {
	const data = useData<AboutPageData>();
	const setConfig = useConfig();
	const locale = data.kind === "root" ? DEFAULT_LOCALE : data.locale;
	const meta = data.metadata;
	setConfig({
		title: meta.title,
		description: meta.description,
		lang: ABOUT_LOCALE_META[locale].htmlLang,
	});
	useReveal(meta.canonicalPath);
	useEffect(() => {
		document.documentElement.lang = ABOUT_LOCALE_META[locale].htmlLang;
	}, [locale]);

	const canonical = new URL(meta.canonicalPath, ABOUT_SITE_ORIGIN).toString();
	const active =
		data.kind === "product" && data.productId === "history"
			? "history"
			: data.kind === "product"
				? data.productId === "content-structure" ||
					data.productId === "entity-attribution" ||
					data.productId === "feed" ||
					data.productId === "editor" ||
					data.productId === "api-oauth"
					? "platform"
					: "products"
				: data.kind === "products"
					? "products"
					: "home";
	const copy = getLocaleContent(locale).common;

	return (
		<MDXProvider components={mdxComponents}>
			<Head>
				<script dangerouslySetInnerHTML={{ __html: themeScript }} />
				<link rel="canonical" href={canonical} />
				{Object.entries(meta.alternates).map(([alternateLocale, path]) => (
					<link
						key={alternateLocale}
						rel="alternate"
						hrefLang={alternateLocale}
						href={new URL(path, ABOUT_SITE_ORIGIN).toString()}
					/>
				))}
				<link
					rel="alternate"
					hrefLang="x-default"
					href={new URL(meta.alternates[DEFAULT_LOCALE], ABOUT_SITE_ORIGIN).toString()}
				/>
				<meta
					property="og:type"
					content={data.kind === "product" ? "product" : "website"}
				/>
				<meta property="og:url" content={canonical} />
				<meta property="og:site_name" content="Rezics" />
				<meta name="twitter:card" content="summary" />
				{meta.jsonLd && (
					<script
						type="application/ld+json"
						dangerouslySetInnerHTML={{ __html: JSON.stringify(meta.jsonLd) }}
					/>
				)}
			</Head>
			{data.kind === "root" ? (
				children
			) : (
				<>
					<GlobalHeader
						locale={locale}
						copy={copy}
						active={active}
						alternatePathByLocale={meta.alternates}
					/>
					<main id="main-content">{children}</main>
					<GlobalFooter locale={locale} copy={copy} />
				</>
			)}
		</MDXProvider>
	);
}
