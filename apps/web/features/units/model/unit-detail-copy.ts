import type { Translation } from "@rezics/i18n";

import type { UnitDetailUnitType } from "./unit-detail-section";

export type UnitDetailSharedPage =
	"overview" | "tags" | "associations" | "reviews" | "collections" | "discussion";

export function unitDetailPageCopy(
	t: Pick<Translation, "units">,
	type: UnitDetailUnitType,
	page: UnitDetailSharedPage,
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
