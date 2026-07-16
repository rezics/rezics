import { ArrowRight, ExternalLink } from "lucide-react";
import { getInterfaceCopy } from "../../content/interfaceCopy";
import { PRODUCT_DEFINITIONS } from "../../content/productRegistry";
import { getSiteCopy } from "../../content/siteCopy";
import type { AboutLocale } from "../../i18n/locales";
import { getProductPath, getProductsPath } from "../../i18n/productPaths";
import { HomeProductStage } from "./HomeProductStage";
import { InteractiveProductDirectory } from "./InteractiveProductDirectory";
import { ProductDemo } from "./ProductDemo";

export function HomeExperience({ locale }: { locale: AboutLocale }) {
	const copy = getSiteCopy(locale);
	const ui = getInterfaceCopy(locale);
	const select = (ids: readonly string[]) =>
		ids.map((id) => {
			const product = PRODUCT_DEFINITIONS.find((entry) => entry.id === id);
			if (!product) throw new Error("Unknown product: " + id);
			return product;
		});
	const products = select(["catalog", "book", "gamebook", "post", "shelf", "zone"]);
	const platform = select([
		"content-structure",
		"history",
		"entity-attribution",
		"feed",
		"editor",
	]);
	const formulas = [
		["Book", "ContentStructure", ui.home.formulaResults.chapters],
		["Book", "GameContentStructure", "GameBook"],
		["Unit", "CreditAttribution", ui.home.formulaResults.credits],
		["Unit", "SubjectAttribution", ui.home.formulaResults.subjects],
	];
	return (
		<>
			<section className="site-section">
				<div className="site-container">
					<div className="section-heading">
						<p className="eyebrow">{copy.home.eyebrow}</p>
						<h1 className="display-title">{copy.home.title}</h1>
						<p className="section-lead">{copy.home.lead}</p>
						<div
							style={{
								display: "flex",
								flexWrap: "wrap",
								gap: ".75rem",
								marginTop: ".5rem",
							}}
						>
							<a className="primary-action" href={getProductsPath(locale)}>
								{copy.nav.products}
								<ArrowRight width={16} height={16} aria-hidden />
							</a>
							<a
								className="secondary-action"
								href="https://outline.rezics.com/collection/rezics-ud1QiRBQYV/recent"
								target="_blank"
								rel="noreferrer"
							>
								{copy.nav.docs}
								<ExternalLink width={15} height={15} aria-hidden />
							</a>
						</div>
					</div>
				</div>
			</section>
			<section className="site-section" style={{ paddingTop: 0 }}>
				<div className="site-container">
					<div className="section-heading reveal">
						<p className="eyebrow">01 · {ui.home.eyebrows.stage}</p>
						<h2 className="section-title">{copy.home.stageTitle}</h2>
						<p className="section-lead">{copy.home.stageLead}</p>
					</div>
					<HomeProductStage locale={locale} />
				</div>
			</section>
			<section className="site-section">
				<div className="site-container">
					<div className="section-heading reveal">
						<p className="eyebrow">02 · {ui.home.eyebrows.products}</p>
						<h2 className="section-title">{copy.home.productsTitle}</h2>
						<p className="section-lead">{copy.home.productsLead}</p>
					</div>
					<InteractiveProductDirectory
						locale={locale}
						products={products}
						instanceId="home-products"
					/>
					<div style={{ marginTop: "2rem" }}>
						<a className="text-link" href={getProductsPath(locale)}>
							{copy.common.viewAll} →
						</a>
					</div>
				</div>
			</section>
			<section className="site-section" id="platform">
				<div className="site-container">
					<div className="section-heading reveal">
						<p className="eyebrow">03 · {ui.home.eyebrows.platform}</p>
						<h2 className="section-title">{copy.home.platformTitle}</h2>
						<p className="section-lead">{copy.home.platformLead}</p>
					</div>
					<InteractiveProductDirectory
						locale={locale}
						products={platform}
						instanceId="home-platform"
					/>
				</div>
			</section>
			<section className="site-section">
				<div className="site-container">
					<div className="section-heading reveal">
						<p className="eyebrow">04 · {ui.home.eyebrows.composition}</p>
						<h2 className="section-title">{copy.home.formulaTitle}</h2>
						<p className="section-lead">{copy.home.formulaLead}</p>
					</div>
					<div className="formula-grid">
						{formulas.map(([left, capability, result]) => (
							<div key={left + capability} className="formula-row reveal">
								<span className="formula-token">{left}</span>
								<span className="formula-symbol">+</span>
								<span className="formula-token">{capability}</span>
								<span className="formula-symbol">→</span>
								<strong className="formula-token">{result}</strong>
							</div>
						))}
					</div>
				</div>
			</section>
			<section className="site-section">
				<div className="site-container">
					<div className="section-heading reveal">
						<p className="eyebrow">05 · {ui.home.eyebrows.history}</p>
						<h2 className="section-title">{copy.home.historyTitle}</h2>
						<p className="section-lead">{copy.home.historyLead}</p>
					</div>
					<ProductDemo
						kind="history"
						productName="History"
						locale={locale}
						label={copy.common.conceptPreview}
						caption={copy.common.conceptCaption}
					/>
					<div className="info-columns" style={{ marginTop: "2rem" }}>
						{(["book", "post", "zone"] as const).map((name) => (
							<article className="info-column" key={name}>
								<h3>{name[0]!.toUpperCase() + name.slice(1)}</h3>
								<p>{ui.home.historyConsumers[name]}</p>
							</article>
						))}
					</div>
					<a
						className="text-link"
						style={{ marginTop: "1.5rem" }}
						href={getProductPath(locale, "history")}
					>
						{copy.common.learnMore} · History →
					</a>
				</div>
			</section>
			<section className="site-section">
				<div className="site-container">
					<div className="section-heading reveal">
						<p className="eyebrow">06 · {ui.home.eyebrows.openSource}</p>
						<h2 className="section-title">{copy.home.openTitle}</h2>
						<p className="section-lead">{copy.home.openLead}</p>
					</div>
					<div className="info-columns">
						<article className="info-column">
							<h3>Outline</h3>
							<p>{ui.home.openDescriptions.outline}</p>
							<a
								className="text-link"
								href="https://outline.rezics.com/collection/rezics-ud1QiRBQYV/recent"
							>
								{copy.nav.docs} →
							</a>
						</article>
						<article className="info-column">
							<h3>API & OAuth</h3>
							<p>{ui.home.openDescriptions.api}</p>
							<a className="text-link" href={getProductPath(locale, "api-oauth")}>
								{copy.common.learnMore} →
							</a>
						</article>
						<article className="info-column">
							<h3>GitHub</h3>
							<p>{ui.home.openDescriptions.github}</p>
							<a className="text-link" href="https://github.com/rezics">
								{copy.nav.github} →
							</a>
						</article>
					</div>
				</div>
			</section>
		</>
	);
}
