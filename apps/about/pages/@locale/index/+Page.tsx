import { useData } from "vike-react/useData";
import { HomeExperience } from "../../../src/components/products/HomeExperience";
import type { AboutPageData } from "../../../src/pageData";

export default function Page() {
	const data = useData<AboutPageData>();
	if (data.kind !== "home") return null;
	return <HomeExperience locale={data.locale} />;
}
