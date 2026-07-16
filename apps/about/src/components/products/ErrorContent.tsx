import { getLocaleContent } from "../../content/locales";
import type { AboutLocale } from "../../i18n/locales";
import { getHomePath } from "../../i18n/productPaths";
import { useData } from "vike-react/useData";
import type { AboutPageData } from "../../pageData";

export function ErrorContent() {
	const data = useData<AboutPageData>();
	const locale: AboutLocale = data.kind === "error" ? data.locale : "zh-hant";
	const copy = getLocaleContent(locale).common;
	return (
		<section className="site-section">
			<div className="site-container">
				<div className="section-heading">
					<p className="eyebrow">{data.kind === "error" ? data.statusCode : 404}</p>
					<h1 className="section-title">{copy.notFound.title}</h1>
					<p className="section-lead">{copy.notFound.body}</p>
					<div>
						<a className="primary-action" href={getHomePath(locale)}>
							{copy.notFound.back}
						</a>
					</div>
				</div>
			</div>
		</section>
	);
}
