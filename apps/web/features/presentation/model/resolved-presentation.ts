import {
	UnitPresentationDocumentV0,
	parseDocument,
	type UnitPresentationDocumentV0 as UnitPresentationDocument,
} from "@rezics/block";
import type { ResolvedUnitPresentationResponse } from "@rezics/openapi-tanstack-query";

export type ResolvedUnitPresentation = Omit<ResolvedUnitPresentationResponse, "document"> & {
	readonly document: UnitPresentationDocument;
};

export type ResolvedCustomTheme = NonNullable<ResolvedUnitPresentation["customTheme"]>;

/** Parse the recursively typed Block document at the generated API boundary. */
export function parseResolvedUnitPresentation(
	value: ResolvedUnitPresentationResponse,
): ResolvedUnitPresentation {
	return {
		...value,
		document: parseDocument(UnitPresentationDocumentV0, value.document),
	};
}
