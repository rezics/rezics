"use client";

import {
	getApiScoresByTargetIdViewerQueryKey,
	useGetApiScoresByTargetIdViewer,
	usePutApiScoresByTargetId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import {
	Button,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	Field,
	FieldLabel,
	NativeSelect,
	NativeSelectOption,
	Rating,
} from "@rezics/ui";
import { useMemo, useState } from "react";

import { useAuthPortal } from "@/features/auth/auth-portal-context";
import {
	DefaultResourceVisibility,
	isResourceVisibility,
	ResourceVisibilityValues,
	type ResourceVisibility,
} from "@/features/privacy/model/resource-visibility";
import type { CatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { RequestFailure } from "@/i18n/request-failure";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { RealmScoreContextLink } from "@/features/realms/components/realm-score-context-link";
import { useDefaultScoreRealm } from "../data/default-score-realm";
import { invalidateReviews } from "../data/review-cache";
import { apiValueToUnitScore, starValueToUnitScore, type UnitScore } from "../model/score-value";
import { ScoreRealmPicker, type ScoreRealmOption } from "./score-realm-picker";

const RatingCount = 5;

export function UnitScoreControl({
	targetId,
	type,
}: {
	readonly targetId: string;
	readonly type: CatalogDetailUnitType;
}) {
	const { data: session, isPending: sessionPending } = useHydratedSession();
	const { openAuthPortal } = useAuthPortal();
	const queryClient = useQueryClient();
	const mutation = usePutApiScoresByTargetId();
	const { t } = useTranslation(["engagement", "ui"]);
	const localizationLanguages = useLocalizationLanguages();
	const defaultScoreRealm = useDefaultScoreRealm();
	const viewerScores = useGetApiScoresByTargetIdViewer(
		{
			path: { targetId },
			query: { localizationLanguages },
		},
		{ query: { enabled: !sessionPending && Boolean(session) } },
	);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [selectedRealm, setSelectedRealm] = useState<ScoreRealmOption>();
	const [draftScore, setDraftScore] = useState<UnitScore>();
	const [draftVisibility, setDraftVisibility] =
		useState<ResourceVisibility>(DefaultResourceVisibility);
	const [pendingDefaultScore, setPendingDefaultScore] = useState<UnitScore>();
	const copy = t.engagement.progressByType[type];

	const scoredRealms = useMemo(
		() =>
			viewerScores.data?.items.flatMap((item): ScoreRealmOption[] => {
				const score = apiValueToUnitScore(item.value);
				return score === undefined
					? []
					: [
							{
								id: item.realmId,
								label: item.realmTitle ?? item.realmId,
								score,
								visibility: item.visibility,
							},
						];
			}) ?? [],
		[viewerScores.data?.items],
	);
	const realmOptions = useMemo(() => {
		const defaultRealm = defaultScoreRealm.realm;
		if (!defaultRealm || scoredRealms.some(({ id }) => id === defaultRealm.id))
			return scoredRealms;
		return [
			{
				...defaultRealm,
				score: undefined,
			},
			...scoredRealms,
		];
	}, [defaultScoreRealm.realm, scoredRealms]);
	const defaultScore = defaultScoreRealm.realm
		? scoredRealms.find(({ id }) => id === defaultScoreRealm.realm?.id)?.score
		: undefined;
	const displayedScore = pendingDefaultScore ?? defaultScore;
	const hasAnyScore = scoredRealms.length > 0;
	const viewerScoresPending = Boolean(session) && viewerScores.isPending;
	const disabled =
		sessionPending || defaultScoreRealm.isPending || viewerScoresPending || mutation.isPending;

	async function saveScore(
		realm: ScoreRealmOption,
		score: UnitScore,
		visibility: ResourceVisibility,
		closeAfterSave: boolean,
	) {
		const isDefaultRealm = realm.id === defaultScoreRealm.realm?.id;
		if (isDefaultRealm) setPendingDefaultScore(score);
		try {
			await mutation.mutateAsync({
				body: { realmId: realm.id, score, visibility },
				path: { targetId },
			});
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: getApiScoresByTargetIdViewerQueryKey({
						path: { targetId },
					}),
				}),
				invalidateReviews(queryClient, undefined, targetId, realm.id),
			]);
			if (closeAfterSave) setDialogOpen(false);
		} catch {
			// The typed mutation state supplies the visible API error.
		} finally {
			if (isDefaultRealm) setPendingDefaultScore(undefined);
		}
	}

	function openScoreEditor() {
		const defaultRealm = defaultScoreRealm.realm;
		if (!defaultRealm) return;
		mutation.reset();
		const option =
			realmOptions.find(({ id }) => id === defaultRealm.id) ??
			({
				...defaultRealm,
				score: undefined,
			} satisfies ScoreRealmOption);
		setSelectedRealm(option);
		setDraftScore(option.score);
		setDraftVisibility(option.visibility ?? DefaultResourceVisibility);
		setDialogOpen(true);
	}

	return (
		<>
			<div className="grid justify-items-center gap-2 py-1">
				{hasAnyScore ? (
					<div className="relative rounded-md">
						<Rating
							allowHalf
							aria-hidden
							className="pointer-events-none text-muted-foreground **:data-[highlighted]:text-warning **:data-[slot=rating-item-indicator]:size-7"
							count={RatingCount}
							readOnly
							value={displayedScore === undefined ? 0 : displayedScore / 2}
						/>
						<button
							aria-label={t.engagement.editScores}
							className="absolute inset-0 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-warning focus-visible:ring-offset-2 disabled:opacity-64"
							disabled={disabled}
							onClick={openScoreEditor}
							type="button"
						/>
					</div>
				) : (
					<Rating
						allowHalf
						aria-label={copy.scoreAction}
						className="text-muted-foreground **:data-[highlighted]:text-warning **:data-[slot=rating-item-indicator]:size-7"
						count={RatingCount}
						disabled={disabled}
						onValueChange={({ value }) => {
							if (!session) {
								openAuthPortal("login");
								return;
							}
							const realm = defaultScoreRealm.realm;
							const nextScore = starValueToUnitScore(value);
							if (!realm || nextScore === undefined) return;
							mutation.reset();
							void saveScore(realm, nextScore, DefaultResourceVisibility, false);
						}}
						value={displayedScore === undefined ? 0 : displayedScore / 2}
					/>
				)}
				<p className="text-center text-sm text-muted-foreground">
					{displayedScore === undefined
						? copy.scoreAction
						: t.engagement.scoreOutOfTen({
								score: String(displayedScore),
							})}
				</p>
				<RequestFailure error={viewerScores.error} fallback={t.ui.retryLater} />
				{dialogOpen ? null : (
					<RequestFailure error={mutation.error} fallback={t.ui.retryLater} />
				)}
			</div>

			<Dialog
				onOpenChange={({ open }) => {
					setDialogOpen(open);
					if (!open && !mutation.isPending) mutation.reset();
				}}
				open={dialogOpen}
			>
				<DialogContent showCloseButton={false} size="sm">
					<DialogHeader
						description={t.engagement.scoreEditorHint}
						title={copy.scoreAction}
					/>
					<DialogBody className="grid gap-5">
						<Field>
							<FieldLabel>{t.engagement.scoreRealm}</FieldLabel>
							<ScoreRealmPicker
								onChange={(realm) => {
									setSelectedRealm(realm);
									setDraftScore(realm.score);
									setDraftVisibility(
										realm.visibility ?? DefaultResourceVisibility,
									);
									mutation.reset();
								}}
								options={realmOptions}
								value={selectedRealm}
							/>
							{selectedRealm ? (
								<div className="grid gap-1.5">
									<p className="text-sm text-muted-foreground">
										{t.engagement.scoreRealmHint({
											realm: selectedRealm.label,
										})}
									</p>
									<RealmScoreContextLink realmId={selectedRealm.id} />
								</div>
							) : null}
						</Field>
						{selectedRealm?.score === undefined ? null : (
							<Field>
								<FieldLabel htmlFor="score-visibility">
									{t.ui.visibility}
								</FieldLabel>
								<NativeSelect
									id="score-visibility"
									onChange={(event) => {
										if (isResourceVisibility(event.target.value))
											setDraftVisibility(event.target.value);
									}}
									value={draftVisibility}
								>
									{ResourceVisibilityValues.map((visibility) => (
										<NativeSelectOption key={visibility} value={visibility}>
											{t.ui[visibility]}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</Field>
						)}
						<div className="grid justify-items-center gap-2">
							<Rating
								allowHalf
								aria-label={copy.scoreAction}
								className="**:data-[slot=rating-item-indicator]:size-8"
								count={RatingCount}
								disabled={!selectedRealm || mutation.isPending}
								onValueChange={({ value }) => {
									const nextScore = starValueToUnitScore(value);
									if (nextScore !== undefined) setDraftScore(nextScore);
								}}
								value={draftScore === undefined ? 0 : draftScore / 2}
							/>
							{draftScore === undefined ? null : (
								<span className="text-sm font-medium">
									{t.engagement.scoreOutOfTen({
										score: String(draftScore),
									})}
								</span>
							)}
						</div>
						<RequestFailure
							error={defaultScoreRealm.error}
							fallback={t.ui.retryLater}
						/>
						<RequestFailure error={mutation.error} fallback={t.ui.retryLater} />
					</DialogBody>
					<DialogFooter>
						<Button onClick={() => setDialogOpen(false)} variant="outline">
							{t.engagement.cancel}
						</Button>
						<Button
							disabled={!selectedRealm || draftScore === undefined}
							isLoading={mutation.isPending}
							onClick={() => {
								if (selectedRealm && draftScore !== undefined)
									void saveScore(
										selectedRealm,
										draftScore,
										draftVisibility,
										true,
									);
							}}
							variant="solid"
						>
							{t.engagement.setScore}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
