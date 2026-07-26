import { useData } from "vike-react/useData";

import { ContactPage } from "../../../src/components/contact/ContactPage";
import type { AboutPageData } from "../../../src/pageData";

export default function Page() {
	const data = useData<AboutPageData>();
	if (data.kind !== "contact") return null;
	return <ContactPage locale={data.locale} />;
}
