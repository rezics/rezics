import { lazy } from "react";

import {
	createProductDocumentResolver,
	readMdxModule,
	type ProductDocumentEntry,
} from "./productDocumentRegistry";

const moduleLoadersByPath = import.meta.glob<unknown>("./locales/*/products/*.mdx");
const entries: ProductDocumentEntry[] = [];

for (const [path, loadModule] of Object.entries(moduleLoadersByPath)) {
	entries.push([
		path,
		lazy(async () => ({
			default: readMdxModule(await loadModule(), path),
		})),
	]);
}

export const getProductDocument = createProductDocumentResolver(entries);
