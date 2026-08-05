"use client";

import {
	getApiUnitsByTypeByUnitIdAliasesQueryKey,
	getApiUnitsByTypeByUnitIdLinksQueryKey,
	useDeleteApiUnitsByTypeByUnitIdAliasesByAliasIdVote,
	useDeleteApiUnitsByTypeByUnitIdLinksByLinkIdVote,
	useGetApiUnitsByTypeByUnitIdAliases,
	useGetApiUnitsByTypeByUnitIdLinks,
	usePatchApiUnitsByTypeByUnitIdAliasesByAliasId,
	usePatchApiUnitsByTypeByUnitIdLinksByLinkId,
	usePostApiUnitsByTypeByUnitIdAliases,
	usePostApiUnitsByTypeByUnitIdLinks,
	usePutApiUnitsByTypeByUnitIdAliasesByAliasIdVote,
	usePutApiUnitsByTypeByUnitIdLinksByLinkIdVote,
} from "@rezics/openapi-tanstack-query";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	EntityPicker,
	Field,
	FieldLabel,
	Input,
	QueryFailure,
	QueryPending,
	toast,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import {
	ArrowBigDownIcon,
	ArrowBigUpIcon,
	ArrowDown,
	ArrowUp,
	ExternalLink,
	Pin,
	PinOff,
} from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { toFiniteApiNumber, toNonNegativeApiInteger } from "@/lib/api-number";
import {
	nextPinnedReferencePosition,
	positionForPinnedReferenceMove,
	type PinnedReferenceCandidate,
} from "../model/reference-curation";
import { invalidateUnitDetail } from "../unit-cache";
import type { UnitType } from "../unit-types";

type SelectedEntity = { readonly id: string; readonly label: string };

function CandidateStatus({ accepted, pinned }: { accepted: boolean; pinned: boolean }) {
	const { t } = useTranslation(["units"]);
	return (
		<div className="flex flex-wrap gap-1">
			<Badge variant={accepted ? "secondary" : "outline"}>
				{accepted ? t.units.references.accepted : t.units.references.candidate}
			</Badge>
			{pinned ? <Badge variant="secondary">{t.units.references.pinned}</Badge> : null}
		</div>
	);
}

function CandidateVoteControls({
	busy,
	onClear,
	onVote,
	score,
	viewerVote,
	voteCount,
}: {
	readonly busy: boolean;
	readonly onClear: () => void;
	readonly onVote: (value: -1 | 1) => void;
	readonly score: string | number;
	readonly viewerVote: -1 | 1 | null;
	readonly voteCount: string | number;
}) {
	const { t } = useTranslation(["units"]);
	return (
		<div className="flex flex-wrap items-center gap-1">
			<span className="mr-2 text-xs text-muted-foreground">
				{t.units.references.voteSummary({
					score: String(toFiniteApiNumber(score) ?? 0),
					count: String(toNonNegativeApiInteger(voteCount)),
				})}
			</span>
			<Button
				aria-pressed={viewerVote === 1}
				disabled={busy}
				onClick={() => (viewerVote === 1 ? onClear() : onVote(1))}
				size="sm"
				type="button"
				variant={viewerVote === 1 ? "secondary" : "quiet"}
			>
				<ArrowBigUpIcon aria-hidden fill={viewerVote === 1 ? "currentColor" : "none"} />
				{t.units.references.support}
			</Button>
			<Button
				aria-pressed={viewerVote === -1}
				disabled={busy}
				onClick={() => (viewerVote === -1 ? onClear() : onVote(-1))}
				size="sm"
				type="button"
				variant={viewerVote === -1 ? "secondary" : "quiet"}
			>
				<ArrowBigDownIcon aria-hidden fill={viewerVote === -1 ? "currentColor" : "none"} />
				{t.units.references.oppose}
			</Button>
		</div>
	);
}

function CurationControls({
	busy,
	candidate,
	candidates,
	onUpdate,
}: {
	readonly busy: boolean;
	readonly candidate: PinnedReferenceCandidate;
	readonly candidates: readonly PinnedReferenceCandidate[];
	readonly onUpdate: (state: { pinned: true; position: string } | { pinned: false }) => void;
}) {
	const { t } = useTranslation(["units"]);
	const pinned = candidates.filter((item) => item.pinned);
	const index = pinned.findIndex((item) => item.id === candidate.id);
	const move = (targetIndex: number) => {
		const position = positionForPinnedReferenceMove(candidates, candidate.id, targetIndex);
		if (position) onUpdate({ pinned: true, position });
	};
	return (
		<div className="flex items-center gap-1">
			{candidate.pinned ? (
				<>
					<Button
						aria-label={t.units.references.moveEarlier}
						disabled={busy || index <= 0}
						onClick={() => move(index - 1)}
						size="icon-sm"
						type="button"
						variant="quiet"
					>
						<ArrowUp aria-hidden />
					</Button>
					<Button
						aria-label={t.units.references.moveLater}
						disabled={busy || index < 0 || index >= pinned.length - 1}
						onClick={() => move(index + 1)}
						size="icon-sm"
						type="button"
						variant="quiet"
					>
						<ArrowDown aria-hidden />
					</Button>
					<Button
						disabled={busy}
						onClick={() => onUpdate({ pinned: false })}
						size="sm"
						type="button"
						variant="outline"
					>
						<PinOff aria-hidden />
						{t.units.references.unpin}
					</Button>
				</>
			) : (
				<Button
					disabled={busy}
					onClick={() =>
						onUpdate({
							pinned: true,
							position: nextPinnedReferencePosition(candidates),
						})
					}
					size="sm"
					type="button"
					variant="outline"
				>
					<Pin aria-hidden />
					{t.units.references.pin}
				</Button>
			)}
		</div>
	);
}

function CandidateList({
	children,
	empty,
	hasItems,
}: {
	readonly children: ReactNode;
	readonly empty: string;
	readonly hasItems: boolean;
}) {
	return hasItems ? <ul className="divide-y rounded-lg border">{children}</ul> : <p>{empty}</p>;
}

function AliasCandidates({
	canCurate,
	type,
	unitId,
}: {
	readonly canCurate: boolean;
	readonly type: UnitType;
	readonly unitId: string;
}) {
	const { t } = useTranslation(["errors", "units"]);
	const queryClient = useQueryClient();
	const queryOptions = { path: { type, unitId } } as const;
	const query = useGetApiUnitsByTypeByUnitIdAliases(queryOptions);
	const create = usePostApiUnitsByTypeByUnitIdAliases();
	const vote = usePutApiUnitsByTypeByUnitIdAliasesByAliasIdVote();
	const clearVote = useDeleteApiUnitsByTypeByUnitIdAliasesByAliasIdVote();
	const curate = usePatchApiUnitsByTypeByUnitIdAliasesByAliasId();
	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: getApiUnitsByTypeByUnitIdAliasesQueryKey(queryOptions),
		});

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (create.isPending) return;
		const form = new FormData(event.currentTarget);
		const term = String(form.get("term") ?? "").trim();
		if (!term) return;
		try {
			await create.mutateAsync({ path: { type, unitId }, body: { term } });
			event.currentTarget.reset();
			await refresh();
			toast.create({ title: t.units.references.aliasProposed, type: "success" });
		} catch {
			// The typed mutation error is rendered below.
		}
	}

	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	const items = query.data?.items ?? [];
	const curationVersion = toNonNegativeApiInteger(query.data?.curationVersion);
	const busy = vote.isPending || clearVote.isPending || curate.isPending;
	return (
		<Card appearance="outlined">
			<CardHeader>
				<CardTitle>{t.units.references.aliasesTitle}</CardTitle>
				<CardDescription>{t.units.references.aliasesDescription}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4">
				<form
					className="flex flex-col gap-2 sm:flex-row"
					onSubmit={(event) => void submit(event)}
				>
					<Input
						aria-label={t.units.references.aliasTerm}
						name="term"
						placeholder={t.units.references.aliasPlaceholder}
						required
					/>
					<Button isLoading={create.isPending} type="submit">
						{t.units.references.proposeAlias}
					</Button>
				</form>
				<CandidateList empty={t.units.references.noAliases} hasItems={items.length > 0}>
					{items.map((candidate) => (
						<li className="grid gap-3 p-3" key={candidate.id}>
							<div className="flex flex-wrap items-start justify-between gap-2">
								<div className="min-w-0">
									<p className="break-words font-medium">{candidate.term}</p>
								</div>
								<CandidateStatus
									accepted={candidate.accepted}
									pinned={candidate.pinned}
								/>
							</div>
							<div className="flex flex-wrap items-center justify-between gap-2">
								<CandidateVoteControls
									busy={busy}
									onClear={() =>
										void clearVote
											.mutateAsync({
												path: { type, unitId, aliasId: candidate.id },
											})
											.then(refresh)
											.catch(() => undefined)
									}
									onVote={(value) =>
										void vote
											.mutateAsync({
												path: { type, unitId, aliasId: candidate.id },
												body: { value },
											})
											.then(refresh)
											.catch(() => undefined)
									}
									score={candidate.score}
									viewerVote={candidate.viewerVote}
									voteCount={candidate.voteCount}
								/>
								{canCurate ? (
									<CurationControls
										busy={busy}
										candidate={candidate}
										candidates={items}
										onUpdate={(state) =>
											void curate
												.mutateAsync({
													path: { type, unitId, aliasId: candidate.id },
													body: state.pinned
														? { baseVersion: curationVersion, ...state }
														: {
																baseVersion: curationVersion,
																pinned: false,
																position: null,
															},
												})
												.then(refresh, refresh)
												.catch(() => undefined)
										}
									/>
								) : null}
							</div>
						</li>
					))}
				</CandidateList>
				<RequestFailure
					error={create.error ?? vote.error ?? clearVote.error ?? curate.error}
					fallback={t.errors.unknown}
				/>
			</CardContent>
		</Card>
	);
}

function SourceLinkCandidates({
	canCurate,
	type,
	unitId,
}: {
	readonly canCurate: boolean;
	readonly type: UnitType;
	readonly unitId: string;
}) {
	const { t } = useTranslation(["errors", "units"]);
	const queryClient = useQueryClient();
	const [source, setSource] = useState<SelectedEntity>();
	const queryOptions = { path: { type, unitId } } as const;
	const query = useGetApiUnitsByTypeByUnitIdLinks(queryOptions);
	const create = usePostApiUnitsByTypeByUnitIdLinks();
	const vote = usePutApiUnitsByTypeByUnitIdLinksByLinkIdVote();
	const clearVote = useDeleteApiUnitsByTypeByUnitIdLinksByLinkIdVote();
	const curate = usePatchApiUnitsByTypeByUnitIdLinksByLinkId();
	const refresh = async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: getApiUnitsByTypeByUnitIdLinksQueryKey(queryOptions),
			}),
			invalidateUnitDetail(queryClient, type, unitId),
		]);
	};

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!source || create.isPending) return;
		const form = new FormData(event.currentTarget);
		const url = String(form.get("url") ?? "").trim();
		if (!url) return;
		try {
			await create.mutateAsync({
				path: { type, unitId },
				body: { sourceEntityUnitId: source.id, url },
			});
			event.currentTarget.reset();
			setSource(undefined);
			await refresh();
			toast.create({ title: t.units.references.linkProposed, type: "success" });
		} catch {
			// The typed mutation error is rendered below.
		}
	}

	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	const items = query.data?.items ?? [];
	const curationVersion = toNonNegativeApiInteger(query.data?.curationVersion);
	const busy = vote.isPending || clearVote.isPending || curate.isPending;
	return (
		<Card appearance="outlined">
			<CardHeader>
				<CardTitle>{t.units.references.linksTitle}</CardTitle>
				<CardDescription>{t.units.references.linksDescription}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4">
				<form
					className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
					onSubmit={(event) => void submit(event)}
				>
					<Field required>
						<FieldLabel>{t.units.references.sourceEntity}</FieldLabel>
						<EntityPicker
							ariaLabel={t.units.references.sourceEntity}
							index="entities"
							onChange={setSource}
							onClear={() => setSource(undefined)}
							placeholder={t.units.references.sourcePlaceholder}
							searchOnOpen
							value={source}
						/>
					</Field>
					<Field required>
						<FieldLabel>{t.units.references.sourceUrl}</FieldLabel>
						<Input
							name="url"
							placeholder={t.units.references.urlPlaceholder}
							required
							type="url"
						/>
					</Field>
					<Button
						className="self-end"
						disabled={!source}
						isLoading={create.isPending}
						type="submit"
					>
						{t.units.references.proposeLink}
					</Button>
				</form>
				<CandidateList empty={t.units.references.noLinks} hasItems={items.length > 0}>
					{items.map((candidate) => (
						<li className="grid gap-3 p-3" key={candidate.id}>
							<div className="flex flex-wrap items-start justify-between gap-2">
								<a
									className="min-w-0 break-all font-medium text-link hover:text-link-hover hover:underline"
									href={candidate.url}
									rel="ugc nofollow noreferrer"
									target="_blank"
								>
									{candidate.url}{" "}
									<ExternalLink aria-hidden className="inline size-3" />
								</a>
								<CandidateStatus
									accepted={candidate.accepted}
									pinned={candidate.pinned}
								/>
							</div>
							<div className="flex flex-wrap items-center justify-between gap-2">
								<CandidateVoteControls
									busy={busy}
									onClear={() =>
										void clearVote
											.mutateAsync({
												path: { type, unitId, linkId: candidate.id },
											})
											.then(refresh)
											.catch(() => undefined)
									}
									onVote={(value) =>
										void vote
											.mutateAsync({
												path: { type, unitId, linkId: candidate.id },
												body: { value },
											})
											.then(refresh)
											.catch(() => undefined)
									}
									score={candidate.score}
									viewerVote={candidate.viewerVote}
									voteCount={candidate.voteCount}
								/>
								{canCurate ? (
									<CurationControls
										busy={busy}
										candidate={candidate}
										candidates={items}
										onUpdate={(state) =>
											void curate
												.mutateAsync({
													path: { type, unitId, linkId: candidate.id },
													body: state.pinned
														? { baseVersion: curationVersion, ...state }
														: {
																baseVersion: curationVersion,
																pinned: false,
																position: null,
															},
												})
												.then(refresh, refresh)
												.catch(() => undefined)
										}
									/>
								) : null}
							</div>
						</li>
					))}
				</CandidateList>
				<RequestFailure
					error={create.error ?? vote.error ?? clearVote.error ?? curate.error}
					fallback={t.errors.unknown}
				/>
			</CardContent>
		</Card>
	);
}

export function UnitReferenceCandidates({
	canCurate,
	type,
	unitId,
}: {
	readonly canCurate: { readonly aliases: boolean; readonly sourceLinks: boolean };
	readonly type: UnitType;
	readonly unitId: string;
}) {
	const { t } = useTranslation(["units"]);
	return (
		<section className="grid scroll-mt-20 gap-4" id="references">
			<div className="grid gap-1">
				<h2 className="font-heading text-xl font-bold">{t.units.references.title}</h2>
				<p className="text-sm text-muted-foreground">{t.units.references.description}</p>
			</div>
			<div className="grid gap-4 xl:grid-cols-2">
				<AliasCandidates canCurate={canCurate.aliases} type={type} unitId={unitId} />
				<SourceLinkCandidates
					canCurate={canCurate.sourceLinks}
					type={type}
					unitId={unitId}
				/>
			</div>
		</section>
	);
}
