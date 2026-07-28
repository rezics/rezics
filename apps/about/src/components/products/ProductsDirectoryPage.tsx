import { ArrowDown, ArrowRight } from "lucide-react";

import { getLocaleContent } from "../../content/locales";
import { getProductsByFamily } from "../../content/productRegistry";
import { PRODUCT_FAMILY_IDS } from "../../content/productTypes";
import type { AboutLocale } from "../../i18n/locales";
import { getProductPath } from "../../i18n/productPaths";

export function ProductsDirectoryPage({ locale }: { readonly locale: AboutLocale }) {
	const copy = getLocaleContent(locale);

	return (
		<>
			<section className="directory-hero">
				<div className="wide-shell directory-hero__inner">
					<h1>{copy.products.hero.title}</h1>
					<p>{copy.products.hero.description}</p>
					<a className="directory-hero__jump" href="#discover">
						{copy.products.familiesTitle}
						<ArrowDown aria-hidden size={17} />
					</a>
				</div>
			</section>

			<nav className="family-index page-shell" aria-label={copy.products.familiesTitle}>
				{PRODUCT_FAMILY_IDS.map((familyId) => {
					const family = copy.products.families[familyId];
					return (
						<a href={`#${familyId}`} key={familyId}>
							<span>{family.index}</span>
							<strong>{family.title}</strong>
						</a>
					);
				})}
			</nav>

			<section className="product-families page-section">
				<div className="page-shell">
					<h2 className="visually-hidden">{copy.products.allTitle}</h2>
					{PRODUCT_FAMILY_IDS.map((familyId) => {
						const family = copy.products.families[familyId];
						const products = getProductsByFamily(familyId);

						return (
							<section className="product-family" id={familyId} key={familyId}>
								<header className="product-family__header">
									<span>{family.index}</span>
									<div>
										<h2>{family.title}</h2>
										<p className="product-family__prompt">{family.prompt}</p>
										<p>{family.description}</p>
									</div>
								</header>
								<div className="product-link-list">
									{products.map((product) => {
										const productId = product.id;
										const name = copy.products.common.names[productId];
										const productCopy = copy.products.byId[productId];

										return (
											<a
												className="product-link-row"
												href={getProductPath(locale, product.slug)}
												key={product.id}
											>
												<strong>{name}</strong>
												<span>{productCopy.summary}</span>
												<ArrowRight aria-hidden size={19} />
											</a>
										);
									})}
								</div>
							</section>
						);
					})}
				</div>
			</section>
		</>
	);
}
