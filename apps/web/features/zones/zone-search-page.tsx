"use client";

import { PageHeading } from "@rezics/ui";
import { useMemo } from "react";
import { parseAsString, useQueryState } from "nuqs";

import { ScopedSearchPage, SearchSurface } from "@/features/search/search-page";
import { useTranslation } from "@/i18n/client";
import { ZoneSurface } from "./components/zone-surface";
import {
	parseZoneSearchEntry,
	ZoneSearchEntrySearchParam,
	type ZoneSearchEntryRequest,
} from "./model/zone-search-entry";

function ZoneSearchEntrySurface({
	entry,
	zoneId,
}: {
	readonly entry: ZoneSearchEntryRequest;
	readonly zoneId: string;
}) {
	const { t } = useTranslation("search");
	return (
		<div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading title={t.title} />
			<SearchSurface
				id={"zone-" + zoneId + "-entry-search"}
				initialState={entry.state}
				injections={entry.injections}
				source={{ kind: "zone", zoneId }}
			/>
		</div>
	);
}

export function ZoneSearchPage({
	baseHref,
	zoneId,
}: {
	readonly baseHref: string;
	readonly zoneId: string;
}) {
	const [rawEntry] = useQueryState(ZoneSearchEntrySearchParam, parseAsString);
	const entry = useMemo(() => parseZoneSearchEntry(rawEntry), [rawEntry]);
	return (
		<ZoneSurface baseHref={baseHref} id={zoneId}>
			{() =>
				entry ? (
					<ZoneSearchEntrySurface entry={entry} key={rawEntry} zoneId={zoneId} />
				) : (
					<div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
						<ScopedSearchPage
							embedded
							id={"zone-" + zoneId + "-search"}
							source={{ kind: "zone", zoneId }}
						/>
					</div>
				)
			}
		</ZoneSurface>
	);
}
