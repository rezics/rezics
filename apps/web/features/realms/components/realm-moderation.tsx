"use client";

import {
	Button,
	Field,
	FieldLabel,
	NativeSelect,
	NativeSelectOption,
	QueryFailure,
	Skeleton,
} from "@rezics/ui";
import { useQueryState } from "nuqs";
import { useCallback, useMemo, useState } from "react";

import { useTranslation } from "@/i18n/client";
import { useRealmModerationQueue } from "../data/realm-moderation-query";
import { realmModerationUnits } from "../model/realm-moderation-cache";
import { RealmModerationStatuses } from "../model/moderation-contract";
import {
	AllRealmModerationStatuses,
	AllRealmReportStates,
	CurrentRealmModerationStatuses,
	ReportedRealmUnits,
	realmModerationFilterParser,
	realmPublicationFilterParser,
	realmReportFilterParser,
	toRealmModerationFilter,
	toRealmPublicationFilter,
	toRealmReportFilter,
} from "../routing/realm-moderation-route";
import { RealmModerationQueue } from "./realm-moderation-queue";
import { RealmModerationSheet } from "./realm-moderation-sheet";

export function RealmModeration({
	realmId,
	embedded = false,
}: {
	readonly realmId: string;
	readonly embedded?: boolean;
}) {
	const { t } = useTranslation(["realms", "reports", "state", "units"]);
	const [filter, setFilter] = useQueryState("status", realmModerationFilterParser);
	const [publicationFilter, setPublicationFilter] = useQueryState(
		"publication",
		realmPublicationFilterParser,
	);
	const [reportFilter, setReportFilter] = useQueryState("reported", realmReportFilterParser);
	const [selectedUnitId, setSelectedUnitId] = useState<string>();
	const queue = useRealmModerationQueue(realmId, filter, publicationFilter, reportFilter);
	const units = useMemo(() => realmModerationUnits(queue.data), [queue.data]);
	const selectedUnit = units.find((unit) => unit.unitId === selectedUnitId);
	const loadNextPage = useCallback(() => {
		void queue.fetchNextPage();
	}, [queue.fetchNextPage]);

	return (
		<section className="grid gap-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div className="min-w-0">
					{embedded ? null : (
						<h2 className="font-heading font-bold text-xl">{t.realms.moderation}</h2>
					)}
					{queue.data ? (
						<p className="mt-1 text-muted-foreground text-sm" role="status">
							{t.realms.moderationLoadedCount({ count: units.length })}
						</p>
					) : null}
				</div>
				<div className="grid w-full gap-3 sm:w-auto sm:grid-cols-3">
					<Field className="w-full sm:w-52">
						<FieldLabel>{t.realms.moderationFilter}</FieldLabel>
						<NativeSelect
							value={filter}
							onChange={(event) => {
								const nextFilter = toRealmModerationFilter(
									event.currentTarget.value,
								);
								setSelectedUnitId(undefined);
								void setFilter(nextFilter);
							}}
						>
							<NativeSelectOption value={CurrentRealmModerationStatuses}>
								{t.units.realmPublications.current}
							</NativeSelectOption>
							<NativeSelectOption value={AllRealmModerationStatuses}>
								{t.realms.allModerationStates}
							</NativeSelectOption>
							{RealmModerationStatuses.map((status) => (
								<NativeSelectOption key={status} value={status}>
									{t.realms.moderationStates[status]}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
					<Field className="w-full sm:w-52">
						<FieldLabel>{t.units.realmPublications.publicationStateFilter}</FieldLabel>
						<NativeSelect
							value={publicationFilter}
							onChange={(event) => {
								setSelectedUnitId(undefined);
								void setPublicationFilter(
									toRealmPublicationFilter(event.currentTarget.value),
								);
							}}
						>
							<NativeSelectOption value="active">
								{t.units.realmPublications.publicationStates.active}
							</NativeSelectOption>
							<NativeSelectOption value="withdrawn">
								{t.units.realmPublications.publicationStates.withdrawn}
							</NativeSelectOption>
							<NativeSelectOption value="all">
								{t.units.realmPublications.all}
							</NativeSelectOption>
						</NativeSelect>
					</Field>
					<Field className="w-full sm:w-52">
						<FieldLabel>{t.reports.filter}</FieldLabel>
						<NativeSelect
							value={reportFilter}
							onChange={(event) => {
								setSelectedUnitId(undefined);
								void setReportFilter(
									toRealmReportFilter(event.currentTarget.value),
								);
							}}
						>
							<NativeSelectOption value={AllRealmReportStates}>
								{t.reports.allContent}
							</NativeSelectOption>
							<NativeSelectOption value={ReportedRealmUnits}>
								{t.reports.reportedContent}
							</NativeSelectOption>
						</NativeSelect>
					</Field>
				</div>
			</div>

			{queue.isPending ? (
				<Skeleton className="h-64 rounded-xl" />
			) : queue.isError && !queue.data ? (
				<QueryFailure error={queue.error} retry={() => void queue.refetch()} />
			) : units.length ? (
				<RealmModerationQueue
					hasNextPage={queue.hasNextPage}
					isFetchingNextPage={queue.isFetchingNextPage}
					nextPageError={queue.isFetchNextPageError ? queue.error : null}
					onLoadNextPage={loadNextPage}
					onSelect={(unit) => setSelectedUnitId(unit.unitId)}
					selectedUnitId={selectedUnitId}
					units={units}
				/>
			) : (
				<div className="grid min-h-48 place-items-center rounded-xl border border-dashed p-8 text-center">
					<div className="grid gap-3">
						<p className="text-muted-foreground text-sm">{t.state.empty}</p>
						{filter === CurrentRealmModerationStatuses &&
						publicationFilter === "active" &&
						reportFilter === AllRealmReportStates ? null : (
							<Button
								onClick={() => {
									void setFilter(CurrentRealmModerationStatuses);
									void setPublicationFilter("active");
									void setReportFilter(AllRealmReportStates);
								}}
								size="sm"
								type="button"
								variant="outline"
							>
								{t.realms.showAllModerationStates}
							</Button>
						)}
					</div>
				</div>
			)}

			{selectedUnit ? (
				<RealmModerationSheet
					cacheQuery={queue.baseQuery}
					filter={filter}
					reportFilter={reportFilter}
					key={selectedUnit.unitId}
					onOpenChange={(open) => {
						if (!open) setSelectedUnitId(undefined);
					}}
					realmId={realmId}
					unit={selectedUnit}
				/>
			) : null}
		</section>
	);
}
