import GithubIcon from "@rezics/icons/components/brand/GithubIcon";
import { ArrowRight } from "lucide-react";

import { getLocaleContent } from "../../content/locales";
import type { AboutLocale } from "../../i18n/locales";

const maintainerAvatarUrl = "https://avatars.githubusercontent.com/u/68896486?v=4";
const maintainerGithubUrl = "https://github.com/Edge-coordinates";

export function ContactPage({ locale }: { readonly locale: AboutLocale }) {
	const copy = getLocaleContent(locale);
	const contact = copy.contact;

	return (
		<>
			<section className="contact-hero">
				<div className="wide-shell contact-hero__inner">
					<h1>{contact.hero.title}</h1>
					<p>{contact.hero.description}</p>
				</div>
			</section>

			<section className="contact-topics page-section">
				<div className="page-shell contact-topics__inner">
					<h2>{contact.topicsTitle}</h2>
					<div className="contact-topic-list">
						{contact.topics.map((topic) => (
							<article key={topic.title}>
								<h3>{topic.title}</h3>
								<p>{topic.body}</p>
							</article>
						))}
					</div>
				</div>
			</section>

			<section className="contact-maintainer page-section">
				<div className="page-shell contact-maintainer__inner">
					<div className="contact-maintainer__intro">
						<h2>{contact.maintainer.title}</h2>
						<p>{contact.maintainer.description}</p>
					</div>

					<article className="contact-profile">
						<div className="contact-profile__identity">
							<img
								alt={contact.maintainer.name}
								height="128"
								referrerPolicy="no-referrer"
								src={maintainerAvatarUrl}
								width="128"
							/>
							<div>
								<h3>{contact.maintainer.name}</h3>
								<p>{contact.maintainer.role}</p>
							</div>
						</div>

						<dl>
							<div>
								<dt>{contact.maintainer.emailLabel}</dt>
								<dd>
									<a href={`mailto:${contact.maintainer.email}`}>
										{contact.maintainer.email}
									</a>
								</dd>
							</div>
							<div>
								<dt>{contact.maintainer.githubLabel}</dt>
								<dd>
									<a href={maintainerGithubUrl} target="_blank" rel="noreferrer">
										<GithubIcon aria-hidden />
										{contact.maintainer.name}
									</a>
								</dd>
							</div>
						</dl>

						<a
							className="action-link action-link--primary"
							href={`mailto:${contact.maintainer.email}`}
						>
							{copy.common.actions.sendEmail}
							<ArrowRight aria-hidden size={16} />
						</a>
					</article>
				</div>
			</section>
		</>
	);
}
