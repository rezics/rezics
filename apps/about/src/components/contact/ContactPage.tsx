import GithubIcon from "@rezics/icons/components/brand/GithubIcon";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import { getLocaleContent } from "../../content/locales";
import type { AboutLocale } from "../../i18n/locales";

const MaintainerAvatarUrl = "https://avatars.githubusercontent.com/u/68896486?v=4";
const MaintainerEmailUrl = "mailto:Edgecoordinates@gmail.com";
const MaintainerGithubUrl = "https://github.com/Edge-coordinates";

export function ContactPage({ locale }: { readonly locale: AboutLocale }) {
	const copy = getLocaleContent(locale).contact;

	return (
		<section className="contact-page">
			<div className="site-container contact-page__inner">
				<header className="contact-page__header">
					<p className="eyebrow">{copy.eyebrow}</p>
					<h1>{copy.title}</h1>
					<p>{copy.introduction}</p>
				</header>
				<article className="contact-card">
					<img
						alt={verbatimTerms.edgeCoordinates.value}
						className="contact-card__avatar"
						height="128"
						referrerPolicy="no-referrer"
						src={MaintainerAvatarUrl}
						width="128"
					/>
					<div className="contact-card__identity">
						<h2>{verbatimTerms.edgeCoordinates.value}</h2>
						<p>{copy.role}</p>
					</div>
					<dl className="contact-card__links">
						<div>
							<dt>{copy.emailLabel}</dt>
							<dd>
								<a href={MaintainerEmailUrl}>
									{verbatimTerms.edgeCoordinatesEmail.value}
								</a>
							</dd>
						</div>
						<div>
							<dt>{copy.githubLabel}</dt>
							<dd>
								<a href={MaintainerGithubUrl} rel="noreferrer" target="_blank">
									<GithubIcon aria-hidden />
									{verbatimTerms.edgeCoordinates.value}
								</a>
							</dd>
						</div>
					</dl>
				</article>
			</div>
		</section>
	);
}
