import { PRODUCT_GROUPS } from "../../content/productRegistry";
import { getSiteCopy } from "../../content/siteCopy";
import type { AboutLocale } from "../../i18n/locales";
import { InteractiveProductDirectory } from "./InteractiveProductDirectory";

export function ProductsDirectoryPage({ locale }: { locale: AboutLocale }) {
	const copy = getSiteCopy(locale);
	return (
		<>
			<section className="site-section">
				<div className="site-container">
					<div className="section-heading">
						<p className="eyebrow">{copy.directory.eyebrow}</p>
						<h1 className="display-title">{copy.directory.title}</h1>
						<p className="section-lead">{copy.directory.lead}</p>
					</div>
				</div>
			</section>
			<section className="site-section" style={{ paddingTop: 0 }}>
				<div className="site-container">
					<div className="section-heading reveal">
						<p className="eyebrow">01</p>
						<h2 className="section-title">{copy.directory.productsTitle}</h2>
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
						<h2 className="section-title">{copy.directory.platformTitle}</h2>
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
