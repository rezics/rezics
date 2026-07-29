import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import { Suspense } from "react";
import { getProductDocument } from "virtual:rezics-about-product-documents";

import { getLocaleContent } from "../../content/locales";
import { getProductDocumentMetadata } from "../../content/productDocumentMetadata";
import {
	getParentProduct,
	getRelatedProducts,
	type RegisteredProduct,
} from "../../content/productRegistry";
import type { AboutLocale } from "../../i18n/locales";
import { getHomePath, getProductPath, getProductsPath } from "../../i18n/productPaths";
import { ProductDemo } from "./ProductDemo";

type ProductPageProps = {
	readonly locale: AboutLocale;
	readonly product: RegisteredProduct;
};

export function ProductPage({ locale, product }: ProductPageProps) {
	const copy = getLocaleContent(locale);
	const productId = product.id;
	const productMetadata = getProductDocumentMetadata(locale, productId);
	const ProductDocument = getProductDocument(locale, productId);
	const family = copy.products.families[product.family];
	const parent = getParentProduct(product);
	const related = getRelatedProducts(product);

	return (
		<>
			<section className="product-hero-section">
				<div className="page-shell">
					<nav className="breadcrumbs" aria-label={copy.common.a11y.breadcrumb}>
						<a href={getHomePath(locale)}>{copy.common.nav.home}</a>
						<ChevronRight aria-hidden size={14} />
						<a href={getProductsPath(locale)}>{copy.common.nav.products}</a>
						<ChevronRight aria-hidden size={14} />
						<span aria-current="page">{productMetadata.name}</span>
					</nav>

					<div className="product-hero">
						<div>
							<a
								className="product-family-link"
								href={`${getProductsPath(locale)}#${product.family}`}
							>
								<span>{family.index}</span>
								{family.title}
							</a>
							<h1>{productMetadata.name}</h1>
						</div>
						<div className="product-hero__copy">
							<p className="product-summary">{productMetadata.summary}</p>
							<p>{productMetadata.introduction}</p>
							{parent ? (
								<p className="product-parent">
									<span>{copy.products.common.labels.parent}</span>
									<a href={getProductPath(locale, parent.slug)}>
										{getProductDocumentMetadata(locale, parent.id).name}
										<ArrowRight aria-hidden size={15} />
									</a>
								</p>
							) : null}
						</div>
					</div>
				</div>
			</section>

			{product.demoKind ? (
				<section className="product-demo-section">
					<div className="page-shell">
						<p className="section-label">{copy.products.common.labels.demo}</p>
						<ProductDemo kind={product.demoKind} locale={locale} />
					</div>
				</section>
			) : null}

			<section className="product-explanation page-section">
				<div className="page-shell">
					<article className="product-document">
						<Suspense
							fallback={
								<p className="product-document__loading">
									{copy.products.common.labels.loading}
								</p>
							}
						>
							<ProductDocument />
						</Suspense>
					</article>
				</div>
			</section>

			<section className="related-products page-section">
				<div className="page-shell">
					<h2>{copy.products.common.labels.related}</h2>
					<div className="related-product-list">
						{related.map((relatedProduct) => {
							const relatedId = relatedProduct.id;
							const relatedMetadata = getProductDocumentMetadata(locale, relatedId);
							return (
								<a
									href={getProductPath(locale, relatedProduct.slug)}
									key={relatedProduct.id}
								>
									<strong>{relatedMetadata.name}</strong>
									<span>{relatedMetadata.summary}</span>
									<ArrowRight aria-hidden size={18} />
								</a>
							);
						})}
					</div>
					<a className="text-action product-back" href={getProductsPath(locale)}>
						<ArrowLeft aria-hidden size={17} />
						{copy.common.actions.viewAllProducts}
					</a>
				</div>
			</section>
		</>
	);
}
