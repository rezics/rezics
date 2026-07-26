import { getLocaleContent } from "../../content/locales";
import type { AboutLocale } from "../../i18n/locales";
import {
	getContactPath,
	getHomePath,
	getProductPath,
	getProductsPath,
} from "../../i18n/productPaths";

export function GlobalFooter({ locale }: { locale: AboutLocale }) {
	const outlineUrl = "https://outline.rezics.com/collection/rezics-ud1QiRBQYV/recent";
	const { common: copy, contact, products } = getLocaleContent(locale);
	const names = products.common.names;
	return (
		<footer className="global-footer">
			<div className="site-container">
				<div className="footer-grid">
					<div className="footer-brand">
						<a
							className="global-logo"
							href={getHomePath(locale)}
							aria-label={copy.a11y.home}
						>
							<img src="/logo.svg" width="34" height="24" alt="" />
						</a>
						<p>{copy.footer.statement}</p>
					</div>
					<nav aria-label={copy.footer.productLinks}>
						<h2>{copy.footer.productLinks}</h2>
						<a href={getProductPath(locale, "book")}>{names.book}</a>
						<a href={getProductPath(locale, "content-structure")}>
							{names["content-structure"]}
						</a>
						<a href={getProductPath(locale, "collection")}>{names.collection}</a>
						<a href={getProductPath(locale, "entity")}>{names.entity}</a>
						<a href={getProductPath(locale, "zone")}>{names.zone}</a>
						<a href={getProductsPath(locale)}>{copy.labels.viewAll}</a>
					</nav>
					<nav aria-label={copy.footer.platformLinks}>
						<h2>{copy.footer.platformLinks}</h2>
						<a href={getProductPath(locale, "history")}>{names.history}</a>
						<a href={getProductPath(locale, "editor")}>{names.editor}</a>
						<a href={getProductPath(locale, "feed")}>{names.feed}</a>
						<a href={getProductPath(locale, "progress")}>{names.progress}</a>
						<a href={getProductPath(locale, "api-oauth")}>{names["api-oauth"]}</a>
					</nav>
					<nav aria-label={copy.footer.openLinks}>
						<h2>{copy.footer.openLinks}</h2>
						<a href={outlineUrl} target="_blank" rel="noreferrer">
							{copy.nav.docs}
						</a>
						<a href="https://github.com/rezics" target="_blank" rel="noreferrer">
							{copy.nav.github}
						</a>
						<a href="https://www.rezics.com" target="_blank" rel="noreferrer">
							rezics.com
						</a>
						<a href={getContactPath(locale)}>{contact.eyebrow}</a>
					</nav>
				</div>
				<div className="footer-meta">
					<span>
						© {new Date().getFullYear()} {copy.siteName}
					</span>
					<span>{copy.footer.implementation}</span>
				</div>
			</div>
		</footer>
	);
}
