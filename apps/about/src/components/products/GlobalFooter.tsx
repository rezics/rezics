import { Logo } from "@rezics/ui/custom/logo";

import { getLocaleContent } from "../../content/locales";
import type { AboutLocale } from "../../i18n/locales";
import {
	getContactPath,
	getHomePath,
	getProductPath,
	getProductsPath,
} from "../../i18n/productPaths";

const githubUrl = "https://github.com/rezics";
const outlineUrl = "https://outline.rezics.com/collection/rezics-ud1QiRBQYV/recent";
const mainSiteUrl = "https://www.rezics.com";

export function GlobalFooter({ locale }: { readonly locale: AboutLocale }) {
	const copy = getLocaleContent(locale);
	const names = copy.products.common.names;

	return (
		<footer className="global-footer">
			<div className="page-shell footer-grid">
				<div className="footer-brand">
					<a
						className="global-logo"
						href={getHomePath(locale)}
						aria-label={copy.common.a11y.home}
					>
						<Logo alt="" aria-hidden="true" />
					</a>
					<p>{copy.footer.statement}</p>
				</div>

				<nav aria-labelledby="footer-products">
					<h2 id="footer-products">{copy.footer.groups.products}</h2>
					<a href={getProductPath(locale, "book")}>{names.book}</a>
					<a href={getProductPath(locale, "content-structure")}>
						{names["content-structure"]}
					</a>
					<a href={getProductPath(locale, "collection")}>{names.collection}</a>
					<a href={getProductPath(locale, "realm")}>{names.realm}</a>
					<a href={getProductsPath(locale)}>{copy.footer.links.allProducts}</a>
				</nav>

				<nav aria-labelledby="footer-platform">
					<h2 id="footer-platform">{copy.footer.groups.platform}</h2>
					<a href={getProductPath(locale, "history")}>{names.history}</a>
					<a href={getProductPath(locale, "editor")}>{names.editor}</a>
					<a href={getProductPath(locale, "feed")}>{names.feed}</a>
					<a href={getProductPath(locale, "progress")}>{names.progress}</a>
					<a href={getProductPath(locale, "api-oauth")}>{names["api-oauth"]}</a>
				</nav>

				<nav aria-labelledby="footer-open">
					<h2 id="footer-open">{copy.footer.groups.open}</h2>
					<a href={outlineUrl} target="_blank" rel="noreferrer">
						{copy.footer.links.docs}
					</a>
					<a href={githubUrl} target="_blank" rel="noreferrer">
						{copy.footer.links.source}
					</a>
					<a href={mainSiteUrl} target="_blank" rel="noreferrer">
						{copy.footer.links.mainSite}
					</a>
					<a href={getContactPath(locale)}>{copy.footer.links.contact}</a>
				</nav>
			</div>

			<div className="page-shell footer-meta">
				<span>{copy.footer.copyright}</span>
				<span>{copy.footer.implementation}</span>
			</div>
		</footer>
	);
}
