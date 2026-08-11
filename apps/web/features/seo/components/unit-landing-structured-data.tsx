import type { UnitLandingSeoRoute } from "../model/unit-landing-seo";
import { getUnitLandingSeoDocument } from "../data/unit-landing-seo.server";

export async function UnitLandingStructuredData(route: UnitLandingSeoRoute) {
	const { structuredData } = await getUnitLandingSeoDocument(route);
	if (!structuredData) return null;
	return (
		<script
			dangerouslySetInnerHTML={{
				__html: JSON.stringify(structuredData).replaceAll("<", "\\u003c"),
			}}
			type="application/ld+json"
		/>
	);
}
