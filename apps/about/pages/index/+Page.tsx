import { Head } from "vike-react/Head";
import { DEFAULT_LOCALE } from "../../src/i18n/locales";
import { getHomePath } from "../../src/i18n/productPaths";
import { getLocaleContent } from "../../src/content/locales";

const defaultPath = getHomePath(DEFAULT_LOCALE);
const siteName = getLocaleContent(DEFAULT_LOCALE).common.siteName;
const redirectScript = "(function(){location.replace(" + JSON.stringify(defaultPath) + ")})()";

export default function Page() {
	return (
		<>
			<Head>
				<script dangerouslySetInnerHTML={{ __html: redirectScript }} />
				<noscript>
					<meta httpEquiv="refresh" content={"0; url=" + defaultPath} />
				</noscript>
			</Head>
			<a href={defaultPath}>{siteName}</a>
		</>
	);
}
