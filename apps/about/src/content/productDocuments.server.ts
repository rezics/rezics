import {
	createProductDocumentResolver,
	readMdxContent,
	type ProductDocumentEntry,
} from "./productDocumentRegistry";

const documentsByPath = import.meta.glob<unknown>("./locales/*/products/*.mdx", {
	eager: true,
	import: "default",
});
const entries: ProductDocumentEntry[] = [];

for (const [path, value] of Object.entries(documentsByPath)) {
	entries.push([path, readMdxContent(value, path)]);
}

export const getProductDocument = createProductDocumentResolver(entries);
