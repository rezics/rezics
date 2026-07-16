import { useRef, useState, type KeyboardEvent } from "react";
import { getLocalizedProductCopy } from "../../content/productCopy";
import { PRODUCT_DEFINITIONS, type ProductId } from "../../content/productRegistry";
import { getSiteCopy } from "../../content/siteCopy";
import type { AboutLocale } from "../../i18n/locales";
import { getProductPath } from "../../i18n/productPaths";
import { ProductDemo } from "./ProductDemo";

const featured = ["book", "history", "content-structure", "zone"].map((id) => {
	const product = PRODUCT_DEFINITIONS.find((entry) => entry.id === id);
	if (!product) throw new Error("Missing featured product: " + id);
	return product;
});

export function HomeProductStage({ locale }: { locale: AboutLocale }) {
	const [active, setActive] = useState(0);
	const refs = useRef<Array<HTMLButtonElement | null>>([]);
	const copy = getSiteCopy(locale);
	const product = featured[active]!;
	const localized = getLocalizedProductCopy(locale, product.id as ProductId);
	const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		let next = active;
		if (event.key === "ArrowRight") next = (active + 1) % featured.length;
		else if (event.key === "ArrowLeft") next = (active - 1 + featured.length) % featured.length;
		else if (event.key === "Home") next = 0;
		else if (event.key === "End") next = featured.length - 1;
		else return;
		event.preventDefault();
		setActive(next);
		refs.current[next]?.focus();
	};
	return (
		<div>
			<div className="tab-list" role="tablist" aria-label={copy.home.stageTitle}>
				{featured.map((entry, index) => (
					<button
						ref={(node) => {
							refs.current[index] = node;
						}}
						key={entry.id}
						className={"tab-button" + (active === index ? " is-active" : "")}
						type="button"
						role="tab"
						aria-selected={active === index}
						tabIndex={active === index ? 0 : -1}
						aria-controls={"home-stage-" + entry.slug}
						onClick={() => setActive(index)}
						onKeyDown={onKeyDown}
					>
						{entry.name}
					</button>
				))}
			</div>
			<section
				id={"home-stage-" + product.slug}
				role="tabpanel"
				style={{ paddingTop: "1rem" }}
			>
				<ProductDemo
					kind={product.demoKind}
					productName={product.name}
					locale={locale}
					label={copy.common.conceptPreview}
					caption={copy.common.conceptCaption}
				/>
				<div
					style={{
						display: "flex",
						flexWrap: "wrap",
						justifyContent: "space-between",
						gap: "1rem",
						marginTop: "1rem",
					}}
				>
					<p className="demo-muted" style={{ maxWidth: "44rem" }}>
						{localized.summary}
					</p>
					<a className="text-link" href={getProductPath(locale, product.slug)}>
						{copy.common.viewProduct} →
					</a>
				</div>
			</section>
		</div>
	);
}
