import type { LocaleContent } from "../../content/locales";
import type { AboutLocale } from "../../i18n/locales";
import { getHomePath, getProductPath, getProductsPath } from "../../i18n/productPaths";

export function GlobalFooter({
	locale,
	copy,
}: {
	locale: AboutLocale;
	copy: LocaleContent["common"];
}) {
	const outlineUrl = "https://outline.rezics.com/collection/rezics-ud1QiRBQYV/recent";
	return (
		<footer className="global-footer">
			<div className="site-container">
				<div className="footer-grid">
					<div className="footer-brand">
						<a className="global-logo" href={getHomePath(locale)} aria-label="Rezics">
							<img src="/logo.svg" width="34" height="24" alt="" />
						</a>
						<p>{copy.footer.statement}</p>
					</div>
					<nav aria-label={copy.footer.productLinks}>
						<h2>{copy.footer.productLinks}</h2>
						<a href={getProductPath(locale, "book")}>Book</a>
						<a href={getProductPath(locale, "content-structure")}>Content Structure</a>
						<a href={getProductPath(locale, "collection")}>Collection</a>
						<a href={getProductPath(locale, "entity")}>Entity</a>
						<a href={getProductPath(locale, "zone")}>Zone</a>
						<a href={getProductsPath(locale)}>{copy.labels.viewAll}</a>
					</nav>
					<nav aria-label={copy.footer.platformLinks}>
						<h2>{copy.footer.platformLinks}</h2>
						<a href={getProductPath(locale, "history")}>History</a>
						<a href={getProductPath(locale, "editor")}>Editor</a>
						<a href={getProductPath(locale, "feed")}>Feed</a>
						<a href={getProductPath(locale, "progress")}>Progress</a>
						<a href={getProductPath(locale, "api-oauth")}>API & OAuth</a>
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
					</nav>
				</div>
				<div className="footer-meta">
					<span>© {new Date().getFullYear()} Rezics</span>
					<span>AGPL-3.0 · Static Vike + React site</span>
				</div>
			</div>
		</footer>
	);
}
