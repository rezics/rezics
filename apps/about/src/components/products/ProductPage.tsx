import { ArrowRight, ExternalLink } from "lucide-react";
import { getInterfaceCopy } from "../../content/interfaceCopy";
import { getLocalizedProductCopy } from "../../content/productCopy";
import { getProductPageFacts } from "../../content/productPageFacts";
import {
	getConsumedCapabilities,
	getProductById,
	getRelatedProducts,
	type ProductId,
} from "../../content/productRegistry";
import { getSiteCopy } from "../../content/siteCopy";
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
	const copy = getSiteCopy(locale);
	const ui = getInterfaceCopy(locale);
	const localized = getLocalizedProductCopy(locale, product.id as ProductId);
	const facts = getProductPageFacts(locale, product, localized);
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
					<nav className="breadcrumbs" aria-label={ui.a11y.breadcrumb}>
						<a href={getHomePath(locale)}>{copy.product.breadcrumbsHome}</a>
						<span aria-hidden>/</span>
						<a href={getProductsPath(locale)}>{copy.product.breadcrumbsProducts}</a>
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
							<p className="eyebrow">{copy.classes[product.pageClass]}</p>
							<h1 className="display-title">{product.name}</h1>
							<p className="product-hero__lead">{localized.value}</p>
							{product.manifestation && (
								<p className="formula-token" style={{ marginTop: "1.5rem" }}>
									{product.manifestation.formula}
								</p>
							)}
						</div>
						<dl className="product-facts">
							<div className="product-fact">
								<dt>{copy.product.statusLabel}</dt>
								<dd>{copy.status[product.implementationStatus]}</dd>
							</div>
							<div className="product-fact">
								<dt>{copy.product.classificationLabel}</dt>
								<dd>{copy.classes[product.pageClass]}</dd>
							</div>
							<div className="product-fact">
								<dt>{copy.common.parentProduct}</dt>
								<dd>
									{parent ? (
										<a href={getProductPath(locale, parent.slug)}>
											{parent.name}
										</a>
									) : (
										copy.common.noParent
									)}
								</dd>
							</div>
							{product.capabilityModes && (
								<div className="product-fact">
									<dt>{ui.a11y.modes}</dt>
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
							label={copy.common.conceptPreview}
							caption={copy.common.conceptCaption}
						/>
						{product.id === "book" && (
							<div style={{ display: "grid", gap: "2rem", marginTop: "2rem" }}>
								<ProductDemo
									kind="attribution"
									productName="Book · Entity & Attribution"
									locale={locale}
									label={copy.common.conceptPreview}
									caption={copy.common.conceptCaption}
								/>
								<ProductDemo
									kind="history"
									productName="Book · History"
									locale={locale}
									label={copy.common.conceptPreview}
									caption={copy.common.conceptCaption}
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
							<h2 className="section-title">{copy.product.scenarios}</h2>
							<p className="section-lead">{localized.scenarioLead}</p>
						</div>
						<div className="info-columns">
							{facts.scenarios.map((fact, index) => (
								<article className="info-column reveal" key={fact}>
									<h3>{String(index + 1).padStart(2, "0")}</h3>
									<p>{fact}</p>
								</article>
							))}
						</div>
					</div>
				</section>
			)}
			{has("workflow") && (
				<section className="site-section">
					<div className="site-container">
						<div className="section-heading reveal">
							<p className="eyebrow">02 · Workflow</p>
							<h2 className="section-title">{copy.product.workflow}</h2>
							<p className="section-lead">{localized.workflowLead}</p>
						</div>
						<div className="product-rows">
							{facts.workflow.map((step, index) => (
								<div
									className="product-row reveal"
									style={{ cursor: "default" }}
									key={step}
								>
									<span className="product-row__name">
										<span className="product-row__index">
											{String(index + 1).padStart(2, "0")}
										</span>
										<span>{step}</span>
									</span>
									<span className="product-row__summary">{product.name}</span>
									<span className="product-row__meta">→</span>
								</div>
							))}
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
								{capabilities.length
									? copy.product.capabilities
									: copy.product.consumers}
							</h2>
						</div>
						<div className="capability-list">
							{(capabilities.length ? capabilities : related).map((item) => {
								const itemCopy = getLocalizedProductCopy(
									locale,
									item.id as ProductId,
								);
								return (
									<a
										className="capability-link reveal"
										href={getProductPath(locale, item.slug)}
										key={item.id}
									>
										<span className="demo-status">{item.name}</span>
										<span>
											<strong>{item.name}</strong>
											<p>{itemCopy.summary}</p>
										</span>
										<span className="text-link">
											{copy.common.learnMore}
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
							<h2 className="section-title">{copy.product.boundaries}</h2>
							<p className="section-lead">{localized.boundaryLead}</p>
						</div>
						<div className="info-columns">
							{facts.boundaries.map((boundary) => (
								<article className="info-column reveal" key={boundary}>
									<p>{boundary}</p>
								</article>
							))}
						</div>
					</div>
				</section>
			)}
			{has("faq") && (
				<section className="site-section">
					<div className="site-container">
						<div className="section-heading reveal">
							<p className="eyebrow">05 · FAQ</p>
							<h2 className="section-title">{copy.product.faq}</h2>
						</div>
						<div className="accordion-list">
							{localized.faq.map((item) => (
								<details className="accordion-item" key={item.question}>
									<summary>{item.question}</summary>
									<div className="accordion-answer">{item.answer}</div>
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
							<h2 className="section-title">{copy.common.relatedProducts}</h2>
						</div>
						<div className="product-rows">
							{related.map((item, index) => {
								const itemCopy = getLocalizedProductCopy(
									locale,
									item.id as ProductId,
								);
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
										<span className="product-row__summary">
											{itemCopy.summary}
										</span>
										<span className="product-row__meta">
											{copy.status[item.implementationStatus]}
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
							<p className="eyebrow">{copy.common.sourceBasis}</p>
							<p className="demo-muted">{product.sourceDocuments.join(" · ")}</p>
							<div style={{ display: "flex", flexWrap: "wrap", gap: ".75rem" }}>
								<a
									className="secondary-action"
									href={outlineUrl}
									target="_blank"
									rel="noreferrer"
								>
									{copy.common.documentation}
									<ExternalLink width={15} height={15} aria-hidden />
								</a>
								<a
									className="secondary-action"
									href="https://github.com/rezics"
									target="_blank"
									rel="noreferrer"
								>
									{copy.common.sourceCode}
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
