import { useData } from "vike-react/useData";
import { ProductPage } from "../../../../src/components/products/ProductPage";
import { getProductById } from "../../../../src/content/productRegistry";
import type { AboutPageData } from "../../../../src/pageData";

export default function Page() {
	const data = useData<AboutPageData>();
	if (data.kind !== "product") return null;
	const product = getProductById(data.productId);
	return <ProductPage locale={data.locale} product={product} />;
}
