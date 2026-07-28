import { ArrowRight, ExternalLink } from "lucide-react";

import { getLocaleContent } from "../../content/locales";
import { PRODUCT_FAMILY_IDS } from "../../content/productTypes";
import type { AboutLocale } from "../../i18n/locales";
import { getContactPath, getProductsPath } from "../../i18n/productPaths";

const githubUrl = "https://github.com/rezics";

export function HomeExperience({ locale }: { readonly locale: AboutLocale }) {
	const copy = getLocaleContent(locale);
	const productsPath = getProductsPath(locale);
	const contactPath = getContactPath(locale);

	return (
		<>
			<section className="home-hero">
				<div className="wide-shell home-hero__inner">
					<h1>{copy.home.hero.title}</h1>
					<p>{copy.home.hero.description}</p>
					<div className="home-hero__actions">
						<a className="action-link action-link--primary" href={productsPath}>
							{copy.common.actions.exploreProducts}
							<ArrowRight aria-hidden size={16} />
						</a>
						<a className="action-link" href="#about">
							{copy.common.actions.learnAbout}
						</a>
					</div>
				</div>
			</section>

			<section className="home-origin page-section" id="about">
				<div className="page-shell">
					<div className="large-statement">
						<h2>{copy.home.origin.title}</h2>
						<p>{copy.home.origin.body}</p>
					</div>
					<div className="principle-list">
						{copy.home.origin.principles.map((principle) => (
							<article key={principle.title}>
								<h3>{principle.title}</h3>
								<p>{principle.body}</p>
							</article>
						))}
					</div>
				</div>
				<div className="wide-shell origin-image">
					<img
						src="/images/about-origin-still-life.webp"
						alt={copy.home.origin.imageAlt}
						width="1536"
						height="1080"
					/>
				</div>
			</section>

			<section className="page-section home-products">
				<div className="page-shell">
					<div className="section-intro">
						<h2>{copy.home.products.title}</h2>
						<p>{copy.home.products.description}</p>
					</div>
					<div className="guide-list">
						{PRODUCT_FAMILY_IDS.map((familyId) => {
							const family = copy.products.families[familyId];
							return (
								<a
									className="guide-row"
									key={familyId}
									href={`${productsPath}#${familyId}`}
								>
									<span className="guide-row__index">{family.index}</span>
									<span className="guide-row__content">
										<strong>{family.title}</strong>
										<span>{family.prompt}</span>
									</span>
									<ArrowRight aria-hidden size={22} />
								</a>
							);
						})}
					</div>
					<a className="text-action" href={productsPath}>
						{copy.common.actions.viewAllProducts}
						<ArrowRight aria-hidden size={17} />
					</a>
				</div>
			</section>

			<section className="page-section open-section">
				<div className="page-shell split-statement">
					<h2>{copy.home.open.title}</h2>
					<div>
						<p>{copy.home.open.body}</p>
						<a
							className="text-action"
							href={githubUrl}
							target="_blank"
							rel="noreferrer"
						>
							{copy.common.actions.visitGithub}
							<ExternalLink aria-hidden size={16} />
						</a>
					</div>
				</div>
			</section>

			<section className="page-section contact-section" id="contact">
				<div className="page-shell contact-section__inner">
					<div>
						<h2>{copy.home.contact.title}</h2>
						<p>{copy.home.contact.introduction}</p>
					</div>
					<ul>
						{copy.home.contact.reasons.map((reason) => (
							<li key={reason}>{reason}</li>
						))}
					</ul>
					<a className="action-link action-link--primary" href={contactPath}>
						{copy.common.actions.contact}
						<ArrowRight aria-hidden size={16} />
					</a>
				</div>
			</section>
		</>
	);
}
