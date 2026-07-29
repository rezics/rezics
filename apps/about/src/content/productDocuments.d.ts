declare module "virtual:rezics-about-product-documents" {
	import type { MDXContent } from "mdx/types";
	import type { LazyExoticComponent } from "react";

	import type { AboutLocale } from "../i18n/locales";
	import type { ProductId } from "./productRegistry";

	export function getProductDocument(
		locale: AboutLocale,
		productId: ProductId,
	): MDXContent | LazyExoticComponent<MDXContent>;
}
