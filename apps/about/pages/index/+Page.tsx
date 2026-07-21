import { Head } from "vike-react/Head";
import { ABOUT_LOCALES, DEFAULT_LOCALE } from "../../src/i18n/locales";
import { getHomePath } from "../../src/i18n/productPaths";
import { getLocaleContent } from "../../src/content/locales";

const defaultPath = getHomePath(DEFAULT_LOCALE);
const siteName = getLocaleContent(DEFAULT_LOCALE).common.siteName;
const localizedPaths = Object.fromEntries(
	ABOUT_LOCALES.map((locale) => [locale, getHomePath(locale)]),
);
const redirectScript =
	"(function(){var p=" +
	JSON.stringify(localizedPaths) +
	";var d=" +
	JSON.stringify(defaultPath) +
	";function m(v){var t=v.trim().toLowerCase().replaceAll('_','-');if(p[t])return t;if(t.indexOf('zh-')===0){if(t.indexOf('zh-hant')===0||['zh-tw','zh-hk','zh-mo'].some(function(x){return t.indexOf(x)===0}))return 'zh-hant';if(t.indexOf('zh-hans')===0||['zh-cn','zh-sg'].some(function(x){return t.indexOf(x)===0}))return 'zh-hans';return 'zh-hant'}var b=t.split('-')[0];return p[b]?b:undefined}var l=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language];var x=l.map(m).find(Boolean);location.replace(x?p[x]:d)})()";

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
