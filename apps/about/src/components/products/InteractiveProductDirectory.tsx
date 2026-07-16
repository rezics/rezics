import { useRef, useState, type KeyboardEvent } from "react";
import { getLocalizedProductCopy } from "../../content/productCopy";
import type { ProductId } from "../../content/productRegistry";
import { getSiteCopy } from "../../content/siteCopy";
import type { ProductDefinition } from "../../content/productTypes";
import type { AboutLocale } from "../../i18n/locales";
import { getProductPath } from "../../i18n/productPaths";
import { ProductDemo } from "./ProductDemo";

export function InteractiveProductDirectory({
	locale,
	products,
	instanceId,
}: {
	locale: AboutLocale;
	products: readonly ProductDefinition[];
	instanceId: string;
}) {
	const [active, setActive] = useState(0);
	const refs = useRef<Array<HTMLButtonElement | null>>([]);
	const copy = getSiteCopy(locale);
	const activateFromKey = (event: KeyboardEvent<HTMLButtonElement>) => {
		let next = active;
		if (event.key === "ArrowDown" || event.key === "ArrowRight")
			next = (active + 1) % products.length;
		else if (event.key === "ArrowUp" || event.key === "ArrowLeft")
			next = (active - 1 + products.length) % products.length;
		else if (event.key === "Home") next = 0;
		else if (event.key === "End") next = products.length - 1;
		else return;
		event.preventDefault();
		setActive(next);
		refs.current[next]?.focus();
	};
	const product = products[active];
	if (!product) return null;
	return (
		<div className="directory-layout">
			<div
				className="directory-list"
				role="tablist"
				aria-label={copy.directory.previewInstruction}
			>
				{products.map((entry, index) => {
					const localized = getLocalizedProductCopy(locale, entry.id as ProductId);
					return (
						<button
							ref={(node) => {
								refs.current[index] = node;
							}}
							key={entry.id}
							className="directory-button"
							type="button"
							role="tab"
							aria-selected={index === active}
							tabIndex={index === active ? 0 : -1}
							aria-controls={instanceId + "-panel-" + entry.slug}
							onClick={() => setActive(index)}
							onFocus={() => setActive(index)}
							onPointerEnter={(event) => {
								if (event.pointerType !== "touch") setActive(index);
							}}
							onKeyDown={activateFromKey}
						>
							<span>
								<strong>{entry.name}</strong>
								<span
									style={{
										display: "block",
										marginTop: ".28rem",
										fontSize: ".76rem",
										lineHeight: 1.5,
									}}
								>
									{localized.summary}
								</span>
							</span>
							<span>{copy.status[entry.implementationStatus]}</span>
						</button>
					);
				})}
			</div>
			<div className="directory-preview">
				<section id={instanceId + "-panel-" + product.slug} role="tabpanel">
					<ProductDemo
						kind={product.demoKind}
						productName={product.name}
						locale={locale}
						label={copy.common.conceptPreview}
						caption={copy.common.conceptCaption}
					/>
					<a
						className="text-link"
						style={{ marginTop: "1rem" }}
						href={getProductPath(locale, product.slug)}
					>
						{copy.common.viewProduct} · {product.name} →
					</a>
				</section>
			</div>
		</div>
	);
}
