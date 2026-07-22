"use client";

import {
	getApiSeriesBySeriesIdReleasesQueryKey,
	useDeleteApiSeriesBySeriesIdReleasesByReleaseId,
	useGetApiSeriesBySeriesIdReleases,
	usePutApiSeriesBySeriesIdReleasesByReleaseId,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	Card,
	CardContent,
	Cover,
	EntityPicker,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { generateKeyBetween } from "fractional-indexing";
import { ArrowDown, ArrowUp, LibraryBig } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { UnitSectionHeader } from "../components/unit-section-header";
import { useUnitManagement } from "../components/unit-management-workspace";

type SelectedUnit = { id: string; label: string };

export function SeriesReleasesPage() {
	const { t } = useTranslation(["actions", "errors", "ui", "units"]);
	const { type, unit } = useUnitManagement();
	const queryClient = useQueryClient();
	const [selectedUnit, setSelectedUnit] = useState<SelectedUnit>();
	const query = useGetApiSeriesBySeriesIdReleases({ path: { seriesId: unit.id } });
	const queryKey = getApiSeriesBySeriesIdReleasesQueryKey({ path: { seriesId: unit.id } });
	const invalidate = async () => queryClient.invalidateQueries({ queryKey });
	const update = usePutApiSeriesBySeriesIdReleasesByReleaseId({
		mutation: { onSuccess: invalidate },
	});
	const remove = useDeleteApiSeriesBySeriesIdReleasesByReleaseId({
		mutation: { onSuccess: invalidate },
	});
	if (type !== "series" || !unit.capabilities.canEdit)
		return <p className="text-sm text-destructive">{t.errors.forbidden}</p>;
	const items = query.data?.items ?? [];

	async function addRelease(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!selectedUnit) return;
		const formElement = event.currentTarget;
		const form = new FormData(formElement);
		const releasedOn = String(form.get("releasedOn") ?? "").trim();
		try {
			await update.mutateAsync({
				path: { seriesId: unit.id, releaseId: selectedUnit.id },
				body: {
					position: generateKeyBetween(items.at(-1)?.position ?? null, null),
					releasedOn: releasedOn || null,
				},
			});
			setSelectedUnit(undefined);
			formElement.reset();
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	async function moveRelease(index: number, direction: "earlier" | "later") {
		const item = items[index];
		if (!item) return;
		const position =
			direction === "earlier"
				? generateKeyBetween(
						items[index - 2]?.position ?? null,
						items[index - 1]?.position ?? null,
					)
				: generateKeyBetween(
						items[index + 1]?.position ?? null,
						items[index + 2]?.position ?? null,
					);
		try {
			await update.mutateAsync({
				path: { seriesId: unit.id, releaseId: item.releaseUnitId },
				body: { position, releasedOn: item.releasedOn },
			});
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<section>
			<UnitSectionHeader
				description={t.units.workspace.sections.releases.description}
				title={t.units.workspace.sections.releases.label}
			/>
			<div className="grid gap-6">
				<Card appearance="outlined">
					<CardContent className="p-6">
						<form onSubmit={addRelease}>
							<FieldGroup>
								<Field required>
									<FieldLabel>{t.units.series.releaseUnit}</FieldLabel>
									<EntityPicker
										index="units"
										onChange={setSelectedUnit}
										value={selectedUnit}
									/>
								</Field>
								<Field>
									<FieldLabel>{t.units.series.releasedOn}</FieldLabel>
									<Input name="releasedOn" type="date" />
								</Field>
								<Button
									disabled={!selectedUnit}
									isLoading={update.isPending}
									type="submit"
								>
									{t.units.series.addRelease}
								</Button>
							</FieldGroup>
						</form>
					</CardContent>
				</Card>
				{query.isPending ? (
					<QueryPending />
				) : query.isError ? (
					<QueryFailure error={query.error} retry={() => void query.refetch()} />
				) : items.length ? (
					<ol className="grid gap-3">
						{items.map((item, index) => (
							<li key={item.releaseUnitId}>
								<Card appearance="outlined">
									<CardContent className="flex items-center gap-4 p-4">
										<Cover
											alt={item.release.title ?? item.release.id}
											className="size-12 shrink-0 rounded-md"
											fallback={<LibraryBig aria-hidden className="size-5" />}
											src={item.release.cover?.url}
										/>
										<div className="min-w-0 flex-1">
											<Link
												className="font-medium hover:underline"
												href={`/units/${item.release.type}/${item.release.id}`}
											>
												{item.release.title ?? item.release.id}
											</Link>
											<p className="text-sm text-muted-foreground">
												{t.units.types[item.release.type]}
												{item.releasedOn ? ` · ${item.releasedOn}` : ""}
											</p>
										</div>
										<div className="flex gap-1">
											<Button
												aria-label={t.units.series.moveEarlier}
												disabled={index === 0 || update.isPending}
												onClick={() => void moveRelease(index, "earlier")}
												size="icon-sm"
												variant="quiet"
											>
												<ArrowUp aria-hidden />
											</Button>
											<Button
												aria-label={t.units.series.moveLater}
												disabled={
													index === items.length - 1 || update.isPending
												}
												onClick={() => void moveRelease(index, "later")}
												size="icon-sm"
												variant="quiet"
											>
												<ArrowDown aria-hidden />
											</Button>
											<Button
												isLoading={remove.isPending}
												onClick={() =>
													remove.mutate({
														path: {
															seriesId: unit.id,
															releaseId: item.releaseUnitId,
														},
													})
												}
												size="sm"
												variant="outline"
											>
												{t.units.series.removeRelease}
											</Button>
										</div>
									</CardContent>
								</Card>
							</li>
						))}
					</ol>
				) : (
					<p className="text-sm text-muted-foreground">{t.units.series.noReleases}</p>
				)}
				<RequestFailure error={update.error ?? remove.error} fallback={t.ui.retryLater} />
			</div>
		</section>
	);
}
