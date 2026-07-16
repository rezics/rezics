import { useData } from "vike-react/useData";
import { ProductsDirectoryPage } from "../../../../src/components/products/ProductsDirectoryPage";
import type { AboutPageData } from "../../../../src/pageData";

export default function Page() {
	const data = useData<AboutPageData>();
	if (data.kind !== "products") return null;
	return <ProductsDirectoryPage locale={data.locale} />;
}
