import type { ReactNode } from "react";
import type { CatalogReference } from "@rezics/reference";
import type { UnitLandingSeoRoute } from "../model/unit-landing-seo";
import { UnitLandingStructuredData } from "./unit-landing-structured-data";
/** Shared public metadata boundary for concrete native Catalog landing routes. */
export function CatalogLandingSeoBoundary({
	children,
	reference,
	requestedLanguage,
}: {
	readonly children: ReactNode;
	readonly reference: CatalogReference;
	readonly requestedLanguage?: UnitLandingSeoRoute["requestedLanguage"];
}) {
	return (
		<>
			<UnitLandingStructuredData
				unitId={reference.id}
				expectedOwner={reference.owner}
				canonicalPath={`/catalog/${reference.owner}/${reference.id}`}
				requestedLanguage={requestedLanguage}
			/>
			{children}
		</>
	);
}
