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
		<section className="error-page">
			<div className="page-shell error-page__inner">
				<p>{data.kind === "error" ? data.statusCode : 404}</p>
				<h1>{copy.notFound.title}</h1>
				<span>{copy.notFound.body}</span>
				<a className="action-link action-link--primary" href={getHomePath(locale)}>
					{copy.actions.backHome}
				</a>
			</div>
		</section>
	);
}
