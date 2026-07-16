import { useRef, useState, type KeyboardEvent } from "react";
import type { ProductId } from "../../content/productRegistry";
import { getLocaleContent } from "../../content/locales";
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
	const { common, products: productContent } = getLocaleContent(locale);
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
				aria-label={productContent.directory.labels.previewInstruction}
			>
				{products.map((entry, index) => {
					const { Summary } = productContent.byId[entry.id as ProductId];
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
								<Summary
									components={{
										p: ({ children }) => (
											<span
												style={{
													display: "block",
													marginTop: ".28rem",
													fontSize: ".76rem",
													lineHeight: 1.5,
												}}
											>
												{children}
											</span>
										),
									}}
								/>
							</span>
							<span>{common.status[entry.implementationStatus]}</span>
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
						label={common.labels.conceptPreview}
						caption={common.labels.conceptCaption}
					/>
					<a
						className="text-link"
						style={{ marginTop: "1rem" }}
						href={getProductPath(locale, product.slug)}
					>
						{common.labels.viewProduct} · {product.name} →
					</a>
				</section>
			</div>
		</div>
	);
}
