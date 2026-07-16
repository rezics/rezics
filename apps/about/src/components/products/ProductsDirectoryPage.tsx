import { PRODUCT_GROUPS } from "../../content/productRegistry";
import { getLocaleContent } from "../../content/locales";
import type { AboutLocale } from "../../i18n/locales";
import { InteractiveProductDirectory } from "./InteractiveProductDirectory";

export function ProductsDirectoryPage({ locale }: { locale: AboutLocale }) {
	const { directory } = getLocaleContent(locale).products;
	return (
		<>
			<section className="site-section">
				<div className="site-container">
					<div className="section-heading">
						<p className="eyebrow">{directory.labels.eyebrow}</p>
						<h1 className="display-title">{directory.labels.title}</h1>
						<div className="section-lead">
							<directory.Lead />
						</div>
					</div>
				</div>
			</section>
			<section className="site-section" style={{ paddingTop: 0 }}>
				<div className="site-container">
					<div className="section-heading reveal">
						<p className="eyebrow">01</p>
						<h2 className="section-title">{directory.labels.productsTitle}</h2>
					</div>
					<InteractiveProductDirectory
						locale={locale}
						products={PRODUCT_GROUPS.products}
						instanceId="all-products"
					/>
				</div>
			</section>
			<section className="site-section" id="platform">
				<div className="site-container">
					<div className="section-heading reveal">
						<p className="eyebrow">02</p>
						<h2 className="section-title">{directory.labels.platformTitle}</h2>
					</div>
					<InteractiveProductDirectory
						locale={locale}
						products={PRODUCT_GROUPS.platform}
						instanceId="all-platform"
					/>
				</div>
			</section>
		</>
	);
}
