import { ArrowRight, ExternalLink } from "lucide-react";
import { getLocaleContent } from "../../content/locales";
import {
	getConsumedCapabilities,
	getProductById,
	getRelatedProducts,
	type ProductId,
} from "../../content/productRegistry";
import type { ProductDefinition } from "../../content/productTypes";
import type { AboutLocale } from "../../i18n/locales";
import { getHomePath, getProductPath, getProductsPath } from "../../i18n/productPaths";
import { ProductDemo } from "./ProductDemo";

export function ProductPage({
	locale,
	product,
}: {
	locale: AboutLocale;
	product: ProductDefinition;
}) {
	const { common, products } = getLocaleContent(locale);
	const page = products.common;
	const localized = products.byId[product.id as ProductId];
	const { Summary, Scenarios, Workflow, Boundaries } = localized;
	const parent = product.canonicalParentId
		? getProductById(product.canonicalParentId)
		: undefined;
	const capabilities = getConsumedCapabilities(product);
	const related = getRelatedProducts(product);
	const has = (section: string) => product.sections.some((item) => item === section);
	const outlineUrl = "https://outline.rezics.com/collection/rezics-ud1QiRBQYV/recent";

	return (
		<>
			<section className="site-section">
				<div className="site-container">
					<nav className="breadcrumbs" aria-label={common.a11y.breadcrumb}>
						<a href={getHomePath(locale)}>{page.breadcrumbsHome}</a>
						<span aria-hidden>/</span>
						<a href={getProductsPath(locale)}>{page.breadcrumbsProducts}</a>
						{parent && (
							<>
								<span aria-hidden>/</span>
								<a href={getProductPath(locale, parent.slug)}>{parent.name}</a>
							</>
						)}
						<span aria-hidden>/</span>
						<span aria-current="page">{product.name}</span>
					</nav>
					<div className="product-hero">
						<div>
							<p className="eyebrow">{common.classes[product.pageClass]}</p>
							<h1 className="display-title">{product.name}</h1>
							<div className="product-hero__lead markdown-copy">
								<Summary />
							</div>
							{product.manifestation && (
								<p className="formula-token" style={{ marginTop: "1.5rem" }}>
									{product.manifestation.formula}
								</p>
							)}
						</div>
						<dl className="product-facts">
							<div className="product-fact">
								<dt>{page.statusLabel}</dt>
								<dd>{common.status[product.implementationStatus]}</dd>
							</div>
							<div className="product-fact">
								<dt>{page.classificationLabel}</dt>
								<dd>{common.classes[product.pageClass]}</dd>
							</div>
							<div className="product-fact">
								<dt>{common.labels.parentProduct}</dt>
								<dd>
									{parent ? (
										<a href={getProductPath(locale, parent.slug)}>
											{parent.name}
										</a>
									) : (
										common.labels.noParent
									)}
								</dd>
							</div>
							{product.capabilityModes && (
								<div className="product-fact">
									<dt>{common.a11y.modes}</dt>
									<dd>{product.capabilityModes.join(" · ")}</dd>
								</div>
							)}
						</dl>
					</div>
				</div>
			</section>

			{has("stage") && (
				<section className="site-section" style={{ paddingTop: 0 }}>
					<div className="site-container">
						<ProductDemo
							kind={product.demoKind}
							productName={product.name}
							locale={locale}
							label={common.labels.conceptPreview}
							caption={common.labels.conceptCaption}
						/>
						{product.id === "book" && (
							<div style={{ display: "grid", gap: "2rem", marginTop: "2rem" }}>
								<ProductDemo
									kind="attribution"
									productName="Book · Entity & Attribution"
									locale={locale}
									label={common.labels.conceptPreview}
									caption={common.labels.conceptCaption}
								/>
								<ProductDemo
									kind="history"
									productName="Book · History"
									locale={locale}
									label={common.labels.conceptPreview}
									caption={common.labels.conceptCaption}
								/>
							</div>
						)}
					</div>
				</section>
			)}

			{has("scenarios") && (
				<section className="site-section">
					<div className="site-container">
						<div className="section-heading reveal">
							<p className="eyebrow">01 · Use</p>
							<h2 className="section-title">{page.scenarios}</h2>
						</div>
						<div className="markdown-section reveal">
							<Scenarios />
						</div>
					</div>
				</section>
			)}

			{has("workflow") && (
				<section className="site-section">
					<div className="site-container">
						<div className="section-heading reveal">
							<p className="eyebrow">02 · Workflow</p>
							<h2 className="section-title">{page.workflow}</h2>
						</div>
						<div className="markdown-section reveal">
							<Workflow />
						</div>
					</div>
				</section>
			)}

			{has("capabilities") && (
				<section className="site-section">
					<div className="site-container">
						<div className="section-heading reveal">
							<p className="eyebrow">03 · Platform</p>
							<h2 className="section-title">
								{capabilities.length ? page.capabilities : page.consumers}
							</h2>
						</div>
						<div className="capability-list">
							{(capabilities.length ? capabilities : related).map((item) => {
								const ItemSummary = products.byId[item.id as ProductId].Summary;
								return (
									<a
										className="capability-link reveal"
										href={getProductPath(locale, item.slug)}
										key={item.id}
									>
										<span className="demo-status">{item.name}</span>
										<div>
											<strong>{item.name}</strong>
											<div className="markdown-copy">
												<ItemSummary />
											</div>
										</div>
										<span className="text-link">
											{common.labels.learnMore}
											<ArrowRight width={15} height={15} aria-hidden />
										</span>
									</a>
								);
							})}
						</div>
					</div>
				</section>
			)}

			{has("boundaries") && (
				<section className="site-section">
					<div className="site-container">
						<div className="section-heading reveal">
							<p className="eyebrow">04 · Scope</p>
							<h2 className="section-title">{page.boundaries}</h2>
						</div>
						<div className="markdown-section reveal">
							<Boundaries />
						</div>
					</div>
				</section>
			)}

			{has("faq") && (
				<section className="site-section">
					<div className="site-container">
						<div className="section-heading reveal">
							<p className="eyebrow">05 · FAQ</p>
							<h2 className="section-title">{page.faq}</h2>
						</div>
						<div className="accordion-list">
							{localized.faq.map(({ question, Answer }) => (
								<details className="accordion-item" key={question}>
									<summary>{question}</summary>
									<div className="accordion-answer markdown-copy">
										<Answer />
									</div>
								</details>
							))}
						</div>
					</div>
				</section>
			)}

			{has("related") && (
				<section className="site-section">
					<div className="site-container">
						<div className="section-heading reveal">
							<p className="eyebrow">06 · Next</p>
							<h2 className="section-title">{common.labels.relatedProducts}</h2>
						</div>
						<div className="product-rows">
							{related.map((item, index) => {
								const ItemSummary = products.byId[item.id as ProductId].Summary;
								return (
									<a
										className="product-row reveal"
										href={getProductPath(locale, item.slug)}
										key={item.id}
									>
										<span className="product-row__name">
											<span className="product-row__index">
												{String(index + 1).padStart(2, "0")}
											</span>
											{item.name}
										</span>
										<div className="product-row__summary markdown-copy">
											<ItemSummary />
										</div>
										<span className="product-row__meta">
											{common.status[item.implementationStatus]}
											<ArrowRight width={16} height={16} aria-hidden />
										</span>
									</a>
								);
							})}
						</div>
						<div
							style={{
								display: "grid",
								gap: "1rem",
								marginTop: "3rem",
								borderTop: "1px solid var(--colors-border-defined)",
								paddingTop: "1.5rem",
							}}
						>
							<p className="eyebrow">{common.labels.sourceBasis}</p>
							<p className="demo-muted">{product.sourceDocuments.join(" · ")}</p>
							<div style={{ display: "flex", flexWrap: "wrap", gap: ".75rem" }}>
								<a
									className="secondary-action"
									href={outlineUrl}
									target="_blank"
									rel="noreferrer"
								>
									{common.labels.documentation}
									<ExternalLink width={15} height={15} aria-hidden />
								</a>
								<a
									className="secondary-action"
									href="https://github.com/rezics"
									target="_blank"
									rel="noreferrer"
								>
									{common.labels.sourceCode}
									<ExternalLink width={15} height={15} aria-hidden />
								</a>
							</div>
						</div>
					</div>
				</section>
			)}
		</>
	);
}
