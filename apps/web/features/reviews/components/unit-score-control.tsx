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
import { useDefaultScoreContext } from "../data/default-score-context";
import { invalidateReviews } from "../data/review-cache";
import { apiValueToUnitScore, starValueToUnitScore, type UnitScore } from "../model/score-value";
import { ScoreContextPicker, type ScoreContextOption } from "./score-context-picker";

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
	const defaultScoreContext = useDefaultScoreContext();
	const viewerScores = useGetApiScoresByTargetIdViewer(
		{
			path: { targetId },
			query: { localizationLanguages },
		},
		{ query: { enabled: !sessionPending && Boolean(session) } },
	);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [selectedContext, setSelectedContext] = useState<ScoreContextOption>();
	const [draftScore, setDraftScore] = useState<UnitScore>();
	const [draftVisibility, setDraftVisibility] =
		useState<ResourceVisibility>(DefaultResourceVisibility);
	const [pendingDefaultScore, setPendingDefaultScore] = useState<UnitScore>();
	const copy = t.engagement.progressByType[type];

	const scoredContexts = useMemo(
		() =>
			viewerScores.data?.items.flatMap((item): ScoreContextOption[] => {
				const score = apiValueToUnitScore(item.value);
				return score === undefined
					? []
					: [
							{
								id: item.contextUnitId,
								label: item.contextUnitTitle ?? item.contextUnitId,
								score,
								visibility: item.visibility,
							},
						];
			}) ?? [],
		[viewerScores.data?.items],
	);
	const contextOptions = useMemo(() => {
		const defaultContext = defaultScoreContext.context;
		if (!defaultContext || scoredContexts.some(({ id }) => id === defaultContext.id))
			return scoredContexts;
		return [
			{
				...defaultContext,
				score: undefined,
			},
			...scoredContexts,
		];
	}, [defaultScoreContext.context, scoredContexts]);
	const defaultScore = defaultScoreContext.context
		? scoredContexts.find(({ id }) => id === defaultScoreContext.context?.id)?.score
		: undefined;
	const displayedScore = pendingDefaultScore ?? defaultScore;
	const hasAnyScore = scoredContexts.length > 0;
	const viewerScoresPending = Boolean(session) && viewerScores.isPending;
	const disabled =
		sessionPending ||
		defaultScoreContext.isPending ||
		viewerScoresPending ||
		mutation.isPending;

	async function saveScore(
		context: ScoreContextOption,
		score: UnitScore,
		visibility: ResourceVisibility,
		closeAfterSave: boolean,
	) {
		const isDefaultContext = context.id === defaultScoreContext.context?.id;
		if (isDefaultContext) setPendingDefaultScore(score);
		try {
			await mutation.mutateAsync({
				body: { contextUnitId: context.id, score, visibility },
				path: { targetId },
			});
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: getApiScoresByTargetIdViewerQueryKey({
						path: { targetId },
					}),
				}),
				invalidateReviews(queryClient, undefined, targetId, context.id),
			]);
			if (closeAfterSave) setDialogOpen(false);
		} catch {
			// The typed mutation state supplies the visible API error.
		} finally {
			if (isDefaultContext) setPendingDefaultScore(undefined);
		}
	}

	function openScoreEditor() {
		const defaultContext = defaultScoreContext.context;
		if (!defaultContext) return;
		mutation.reset();
		const option =
			contextOptions.find(({ id }) => id === defaultContext.id) ??
			({
				...defaultContext,
				score: undefined,
			} satisfies ScoreContextOption);
		setSelectedContext(option);
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
							const context = defaultScoreContext.context;
							const nextScore = starValueToUnitScore(value);
							if (!context || nextScore === undefined) return;
							mutation.reset();
							void saveScore(context, nextScore, DefaultResourceVisibility, false);
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
							<FieldLabel>{t.engagement.scoreContext}</FieldLabel>
							<ScoreContextPicker
								onChange={(context) => {
									setSelectedContext(context);
									setDraftScore(context.score);
									setDraftVisibility(
										context.visibility ?? DefaultResourceVisibility,
									);
									mutation.reset();
								}}
								options={contextOptions}
								value={selectedContext}
							/>
							{selectedContext ? (
								<p className="text-sm text-muted-foreground">
									{t.engagement.scoreContextHint({
										context: selectedContext.label,
									})}
								</p>
							) : null}
						</Field>
						{selectedContext?.score === undefined ? null : (
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
								disabled={!selectedContext || mutation.isPending}
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
							error={defaultScoreContext.error}
							fallback={t.ui.retryLater}
						/>
						<RequestFailure error={mutation.error} fallback={t.ui.retryLater} />
					</DialogBody>
					<DialogFooter>
						<Button onClick={() => setDialogOpen(false)} variant="outline">
							{t.engagement.cancel}
						</Button>
						<Button
							disabled={!selectedContext || draftScore === undefined}
							isLoading={mutation.isPending}
							onClick={() => {
								if (selectedContext && draftScore !== undefined)
									void saveScore(
										selectedContext,
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
