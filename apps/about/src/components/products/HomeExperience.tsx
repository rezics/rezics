import { ArrowRight, ExternalLink } from "lucide-react";
import { PRODUCT_DEFINITIONS, type ProductId } from "../../content/productRegistry";
import { getLocaleContent } from "../../content/locales";
import type { AboutLocale } from "../../i18n/locales";
import { getProductPath, getProductsPath } from "../../i18n/productPaths";
import { HomeProductStage } from "./HomeProductStage";
import { InteractiveProductDirectory } from "./InteractiveProductDirectory";
import { ProductDemo } from "./ProductDemo";

export function HomeExperience({ locale }: { locale: AboutLocale }) {
	const { common, home } = getLocaleContent(locale);
	const { Hero, Stage, Products, Platform, Composition, History, OpenSource } = home.sections;
	const { book: HistoryBook, post: HistoryPost, zone: HistoryZone } = home.historyConsumers;
	const { outline: OpenOutline, api: OpenApi, github: OpenGithub } = home.openDescriptions;
	const select = (ids: readonly ProductId[]) =>
		ids.map((id) => {
			const product = PRODUCT_DEFINITIONS.find((entry) => entry.id === id);
			if (!product) throw new Error("Unknown product: " + id);
			return product;
		});
	const products = select(["content-structure", "collection", "realm", "zone", "tag", "entity"]);
	const platform = select(["history", "editor", "feed", "progress", "api-oauth"]);
	const formulas = [
		["Book", "ContentStructure", home.labels.formulaResults.chapters],
		["Book", "GameContentStructure", "GameBook"],
		["Unit", "CreditAttribution", home.labels.formulaResults.credits],
		["Unit", "SubjectAssociation", home.labels.formulaResults.subjects],
	];

	return (
		<>
			<section className="site-section">
				<div className="site-container">
					<div className="section-heading">
						<p className="eyebrow">{home.labels.eyebrow}</p>
						<h1 className="display-title">{home.labels.title}</h1>
						<div className="section-lead">
							<Hero />
						</div>
						<div
							style={{
								display: "flex",
								flexWrap: "wrap",
								gap: ".75rem",
								marginTop: ".5rem",
							}}
						>
							<a className="primary-action" href={getProductsPath(locale)}>
								{common.nav.products}
								<ArrowRight width={16} height={16} aria-hidden />
							</a>
							<a
								className="secondary-action"
								href="https://outline.rezics.com/collection/rezics-ud1QiRBQYV/recent"
								target="_blank"
								rel="noreferrer"
							>
								{common.nav.docs}
								<ExternalLink width={15} height={15} aria-hidden />
							</a>
						</div>
					</div>
				</div>
			</section>

			<section className="site-section" style={{ paddingTop: 0 }}>
				<div className="site-container">
					<div className="section-heading reveal">
						<p className="eyebrow">01 · {home.labels.eyebrows.stage}</p>
						<h2 className="section-title">{home.labels.stageTitle}</h2>
						<div className="section-lead">
							<Stage />
						</div>
					</div>
					<HomeProductStage locale={locale} />
				</div>
			</section>

			<section className="site-section">
				<div className="site-container">
					<div className="section-heading reveal">
						<p className="eyebrow">02 · {home.labels.eyebrows.products}</p>
						<h2 className="section-title">{home.labels.productsTitle}</h2>
						<div className="section-lead">
							<Products />
						</div>
					</div>
					<InteractiveProductDirectory
						locale={locale}
						products={products}
						instanceId="home-products"
					/>
					<div style={{ marginTop: "2rem" }}>
						<a className="text-link" href={getProductsPath(locale)}>
							{common.labels.viewAll} →
						</a>
					</div>
				</div>
			</section>

			<section className="site-section" id="platform">
				<div className="site-container">
					<div className="section-heading reveal">
						<p className="eyebrow">03 · {home.labels.eyebrows.platform}</p>
						<h2 className="section-title">{home.labels.platformTitle}</h2>
						<div className="section-lead">
							<Platform />
						</div>
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
						<p className="eyebrow">04 · {home.labels.eyebrows.composition}</p>
						<h2 className="section-title">{home.labels.formulaTitle}</h2>
						<div className="section-lead">
							<Composition />
						</div>
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
						<p className="eyebrow">05 · {home.labels.eyebrows.history}</p>
						<h2 className="section-title">{home.labels.historyTitle}</h2>
						<div className="section-lead">
							<History />
						</div>
					</div>
					<ProductDemo
						kind="history"
						productName="History"
						locale={locale}
						label={common.labels.conceptPreview}
						caption={common.labels.conceptCaption}
					/>
					<div className="info-columns" style={{ marginTop: "2rem" }}>
						<article className="info-column">
							<h3>Book</h3>
							<HistoryBook />
						</article>
						<article className="info-column">
							<h3>Post</h3>
							<HistoryPost />
						</article>
						<article className="info-column">
							<h3>Zone</h3>
							<HistoryZone />
						</article>
					</div>
					<a
						className="text-link"
						style={{ marginTop: "1.5rem" }}
						href={getProductPath(locale, "history")}
					>
						{common.labels.learnMore} · History →
					</a>
				</div>
			</section>

			<section className="site-section">
				<div className="site-container">
					<div className="section-heading reveal">
						<p className="eyebrow">06 · {home.labels.eyebrows.openSource}</p>
						<h2 className="section-title">{home.labels.openTitle}</h2>
						<div className="section-lead">
							<OpenSource />
						</div>
					</div>
					<div className="info-columns">
						<article className="info-column">
							<h3>Outline</h3>
							<OpenOutline />
							<a
								className="text-link"
								href="https://outline.rezics.com/collection/rezics-ud1QiRBQYV/recent"
							>
								{common.nav.docs} →
							</a>
						</article>
						<article className="info-column">
							<h3>API & OAuth</h3>
							<OpenApi />
							<a className="text-link" href={getProductPath(locale, "api-oauth")}>
								{common.labels.learnMore} →
							</a>
						</article>
						<article className="info-column">
							<h3>GitHub</h3>
							<OpenGithub />
							<a className="text-link" href="https://github.com/rezics">
								{common.nav.github} →
							</a>
						</article>
					</div>
				</div>
			</section>
		</>
	);
}
