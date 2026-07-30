import type { Translation } from "@rezics/i18n";

import type { CatalogDetailUnitType } from "./catalog-detail-section";

export type CatalogDetailSharedPage =
	"overview" | "tags" | "associations" | "reviews" | "collections" | "discussion";

export function catalogDetailPageCopy(
	t: Pick<Translation, "units">,
	type: CatalogDetailUnitType,
	page: CatalogDetailSharedPage,
): {
	readonly description: string;
	readonly title: string;
} {
	switch (type) {
		case "book":
			return {
				title: t.units.detail.tabs.book[page],
				description: t.units.detail.sectionDescriptions.book[page],
			};
		case "media":
			return {
				title: t.units.detail.tabs.media[page],
				description: t.units.detail.sectionDescriptions.media[page],
			};
		case "software":
			return {
				title: t.units.detail.tabs.software[page],
				description: t.units.detail.sectionDescriptions.software[page],
			};
		case "series":
			return {
				title: t.units.detail.tabs.series[page],
				description: t.units.detail.sectionDescriptions.series[page],
			};
	}
}
