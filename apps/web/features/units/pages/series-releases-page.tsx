"use client";

import {
	getApiSeriesBySeriesIdReleasesQueryKey,
	useDeleteApiSeriesBySeriesIdReleasesByReleaseId,
	useGetApiSeriesBySeriesIdReleases,
	usePutApiSeriesBySeriesIdReleasesByReleaseId,
} from "@rezics/openapi-tanstack-query";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
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
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { type FormEvent, useState } from "react";

import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { RequestFailure } from "@/i18n/request-failure";
import { SeriesReleaseCard, type SeriesReleaseItem } from "../components/series-release-card";
import { UnitSectionHeader } from "../components/unit-section-header";
import { useUnitManagement } from "../components/unit-management-workspace";

type SelectedUnit = { id: string; label: string };

export function SeriesReleasesPage() {
	const { t } = useTranslation(["actions", "errors", "ui", "units"]);
	const { type, unit } = useUnitManagement();
	const queryClient = useQueryClient();
	const [selectedUnit, setSelectedUnit] = useState<SelectedUnit>();
	const [addOpen, setAddOpen] = useState(false);
	const [releasePendingRemoval, setReleasePendingRemoval] = useState<SeriesReleaseItem>();
	const localizationLanguages = useLocalizationLanguages();
	const queryParams = {
		path: { seriesId: unit.id },
		query: { localizationLanguages },
	};
	const query = useGetApiSeriesBySeriesIdReleases(queryParams);
	const queryKey = getApiSeriesBySeriesIdReleasesQueryKey(queryParams);
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
			setAddOpen(false);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	async function moveRelease(index: number, direction: "earlier" | "later") {
		const item = items[index];
		if (!item) return;
		const position =
			direction === "earlier"
				? generateKeyBetween(items[index - 2]?.position ?? null, items[index - 1]?.position ?? null)
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
				action={
					<Button onClick={() => setAddOpen(true)}>
						<Plus aria-hidden />
						{t.units.series.addRelease}
					</Button>
				}
				description={t.units.workspace.sections.releases.description}
				title={t.units.workspace.sections.releases.label}
			/>
			<div className="grid gap-6">
				{query.isPending ? (
					<QueryPending />
				) : query.isError ? (
					<QueryFailure error={query.error} retry={() => void query.refetch()} />
				) : items.length ? (
					<ol className="grid gap-3">
						{items.map((item, index) => (
							<li key={item.releaseUnitId}>
								<SeriesReleaseCard
									actions={
										<>
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
												disabled={index === items.length - 1 || update.isPending}
												onClick={() => void moveRelease(index, "later")}
												size="icon-sm"
												variant="quiet"
											>
												<ArrowDown aria-hidden />
											</Button>
											<Button
												disabled={remove.isPending}
												onClick={() => setReleasePendingRemoval(item)}
												size="sm"
												variant="outline"
											>
												{t.units.series.removeRelease}
											</Button>
										</>
									}
									item={item}
									position={index + 1}
									setSize={items.length}
								/>
							</li>
						))}
					</ol>
				) : (
					<p className="text-sm text-muted-foreground">{t.units.series.noReleases}</p>
				)}
				<RequestFailure error={update.error ?? remove.error} fallback={t.ui.retryLater} />
			</div>
			<Dialog
				onOpenChange={({ open }) => {
					if (!update.isPending) setAddOpen(open);
					if (!open && !update.isPending) setSelectedUnit(undefined);
				}}
				open={addOpen}
			>
				<DialogContent showCloseButton={!update.isPending} size="sm">
					<DialogHeader
						description={t.units.workspace.sections.releases.description}
						title={t.units.series.addRelease}
					/>
					<form onSubmit={addRelease}>
						<DialogBody>
							<FieldGroup>
								<Field required>
									<FieldLabel>{t.units.series.releaseUnit}</FieldLabel>
									<EntityPicker
										ariaLabel={t.units.series.releaseUnit}
										index="units"
										kinds={["book", "media", "software"]}
										onChange={setSelectedUnit}
										placeholder={t.ui.pickerPlaceholders.unit}
										value={selectedUnit}
									/>
								</Field>
								<Field>
									<FieldLabel>{t.units.series.releasedOn}</FieldLabel>
									<Input name="releasedOn" type="date" />
								</Field>
							</FieldGroup>
						</DialogBody>
						<DialogFooter>
							<Button
								disabled={update.isPending}
								onClick={() => setAddOpen(false)}
								type="button"
								variant="outline"
							>
								{t.units.contentLanguages.cancel}
							</Button>
							<Button disabled={!selectedUnit} isLoading={update.isPending} type="submit">
								{t.units.series.addRelease}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
			<AlertDialog
				onOpenChange={({ open }) => {
					if (!open && !remove.isPending) setReleasePendingRemoval(undefined);
				}}
				open={Boolean(releasePendingRemoval)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t.units.series.removeRelease}</AlertDialogTitle>
						<AlertDialogDescription>
							{t.units.series.removeReleaseConfirm({
								title:
									releasePendingRemoval?.release.title ??
									releasePendingRemoval?.release.id ??
									t.ui.unnamed,
							})}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={remove.isPending}>
							{t.units.contentLanguages.cancel}
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={!releasePendingRemoval || remove.isPending}
							onClick={() => {
								if (!releasePendingRemoval) return;
								remove.mutate({
									path: {
										seriesId: unit.id,
										releaseId: releasePendingRemoval.releaseUnitId,
									},
								});
								setReleasePendingRemoval(undefined);
							}}
							variant="destructive"
						>
							{t.units.series.removeRelease}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</section>
	);
}
