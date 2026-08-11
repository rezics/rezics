"use client";

import {
	getApiEntitiesByUnitIdQueryKey,
	getApiUnitsByTypeByUnitIdExternalLinksQueryKey,
	type GetApiEntitiesByUnitIdStatus200,
	type GetApiUnitsByTypeByUnitIdExternalLinksStatus200,
	useDeleteApiUnitsByTypeByUnitIdExternalLinksByExternalLinkIdVote,
	useGetApiUnitsByTypeByUnitIdExternalLinks,
	usePostApiUnitsByTypeByUnitIdExternalLinks,
	usePutApiUnitsByTypeByUnitIdExternalLinksByExternalLinkIdVote,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	EntityPicker,
	Field,
	FieldLabel,
	Input,
	cn,
	toast,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowBigDownIcon, ArrowBigUpIcon, Plus } from "lucide-react";
import { type FormEvent, useState } from "react";

import { useDevelopmentPreviewAccess } from "@/features/preview-access/components/development-preview-boundary";
import { UnitExternalLinkBadge } from "@/features/units/components/unit-external-links";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { toFiniteApiNumber, toNonNegativeApiInteger } from "@/lib/api-number";
import { useHydratedSession } from "@/lib/use-hydrated-session";

type EntityDetailExternalLink = GetApiEntitiesByUnitIdStatus200["externalLinks"][number];
type EntityExternalLinkCandidate = GetApiUnitsByTypeByUnitIdExternalLinksStatus200["items"][number];
type SelectedEntity = { readonly id: string; readonly label: string };

function ExternalLinkVoteControls({
	busy,
	canVote,
	link,
	onClear,
	onVote,
}: {
	readonly busy: boolean;
	readonly canVote: boolean;
	readonly link: EntityExternalLinkCandidate;
	readonly onClear: () => void;
	readonly onVote: (value: -1 | 1) => void;
}) {
	const { t } = useTranslation(["units"]);
	const score = toFiniteApiNumber(link.voteSummary.score) ?? 0;
	const voteCount = toNonNegativeApiInteger(link.voteSummary.voteCount);
	return (
		<div className="grid gap-2">
			<span className="text-xs text-muted-foreground">
				{t.units.references.voteSummary({
					score: String(score),
					count: String(voteCount),
				})}
			</span>
			{canVote ? (
				<div className="flex flex-wrap items-center gap-1">
					<Button
						aria-pressed={link.voteSummary.viewerVote === 1}
						className={cn(link.voteSummary.viewerVote === 1 && "text-primary hover:text-primary")}
						disabled={busy}
						onClick={() => (link.voteSummary.viewerVote === 1 ? onClear() : onVote(1))}
						size="sm"
						type="button"
						variant="quiet"
					>
						<ArrowBigUpIcon
							aria-hidden
							fill={link.voteSummary.viewerVote === 1 ? "currentColor" : "none"}
						/>
						{t.units.references.support}
					</Button>
					<Button
						aria-pressed={link.voteSummary.viewerVote === -1}
						className={cn(link.voteSummary.viewerVote === -1 && "text-info hover:text-info")}
						disabled={busy}
						onClick={() => (link.voteSummary.viewerVote === -1 ? onClear() : onVote(-1))}
						size="sm"
						type="button"
						variant="quiet"
					>
						<ArrowBigDownIcon
							aria-hidden
							fill={link.voteSummary.viewerVote === -1 ? "currentColor" : "none"}
						/>
						{t.units.references.oppose}
					</Button>
				</div>
			) : null}
		</div>
	);
}

function ExternalLinkCard({
	busy,
	canVote,
	link,
	onClear,
	onVote,
}: {
	readonly busy: boolean;
	readonly canVote: boolean;
	readonly link: EntityExternalLinkCandidate;
	readonly onClear: () => void;
	readonly onVote: (value: -1 | 1) => void;
}) {
	return (
		<UnitExternalLinkBadge
			controls={
				<ExternalLinkVoteControls
					busy={busy}
					canVote={canVote}
					link={link}
					onClear={onClear}
					onVote={onVote}
				/>
			}
			link={link}
		/>
	);
}

export function EntityExternalLinks({
	entityId,
	initialExternalLinks,
}: {
	readonly entityId: string;
	readonly initialExternalLinks: readonly EntityDetailExternalLink[];
}) {
	const { t } = useTranslation(["entities", "errors", "ui", "units"]);
	const { data: session } = useHydratedSession();
	const developmentPreview = useDevelopmentPreviewAccess();
	const localizationLanguages = useLocalizationLanguages();
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [source, setSource] = useState<SelectedEntity>();
	const [url, setUrl] = useState("");
	const queryOptions = {
		path: { type: "entity" as const, unitId: entityId },
		query: { localizationLanguages },
	};
	const query = useGetApiUnitsByTypeByUnitIdExternalLinks(queryOptions, {
		query: { enabled: Boolean(session) },
	});
	const create = usePostApiUnitsByTypeByUnitIdExternalLinks();
	const vote = usePutApiUnitsByTypeByUnitIdExternalLinksByExternalLinkIdVote();
	const clearVote = useDeleteApiUnitsByTypeByUnitIdExternalLinksByExternalLinkIdVote();
	const refresh = () =>
		Promise.all([
			queryClient.invalidateQueries({
				queryKey: getApiUnitsByTypeByUnitIdExternalLinksQueryKey(queryOptions),
			}),
			queryClient.invalidateQueries({
				queryKey: getApiEntitiesByUnitIdQueryKey({ path: { unitId: entityId } }),
			}),
		]);
	const externalLinks: readonly EntityExternalLinkCandidate[] = session
		? (query.data?.items ?? initialExternalLinks)
		: initialExternalLinks;
	const voteBusy = vote.isPending || clearVote.isPending;

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!source || !url.trim() || create.isPending) return;
		try {
			await create.mutateAsync({
				path: { type: "entity", unitId: entityId },
				body: { sourceEntityId: source.id, url: url.trim() },
			});
			await refresh();
			setSource(undefined);
			setUrl("");
			setDialogOpen(false);
			toast.create({ title: t.units.references.externalLinkProposed, type: "success" });
		} catch {
			// The typed mutation error is rendered in the dialog.
		}
	}

	return (
		<section className="grid scroll-mt-20 gap-4" id="external-links">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-1">
					<h2 className="font-heading text-xl font-bold">{t.units.detail.externalLinks}</h2>
					<p className="text-sm text-muted-foreground">{t.entities.externalLinksDescription}</p>
				</div>
				{developmentPreview.state === "allowed" ? (
					<Button onClick={() => setDialogOpen(true)} size="sm" type="button" variant="outline">
						<Plus aria-hidden />
						{t.units.references.proposeExternalLink}
					</Button>
				) : null}
			</div>
			{externalLinks.length ? (
				<div className="flex flex-wrap gap-2">
					{externalLinks.map((link) => (
						<ExternalLinkCard
							busy={voteBusy}
							canVote={Boolean(session)}
							key={link.id}
							link={link}
							onClear={() =>
								void clearVote
									.mutateAsync({
										path: {
											type: "entity",
											unitId: entityId,
											externalLinkId: link.id,
										},
									})
									.then(refresh)
									.catch(() => undefined)
							}
							onVote={(value) =>
								void vote
									.mutateAsync({
										path: {
											type: "entity",
											unitId: entityId,
											externalLinkId: link.id,
										},
										body: { value },
									})
									.then(refresh)
									.catch(() => undefined)
							}
						/>
					))}
				</div>
			) : (
				<p className="text-sm text-muted-foreground">{t.entities.externalLinksEmpty}</p>
			)}
			<RequestFailure
				error={query.error ?? vote.error ?? clearVote.error}
				fallback={t.errors.unknown}
			/>

			<Dialog
				onOpenChange={({ open }) => {
					if (!create.isPending) setDialogOpen(open);
				}}
				open={dialogOpen}
			>
				<DialogContent showCloseButton={!create.isPending} size="sm">
					<DialogHeader
						description={t.entities.externalLinksDescription}
						title={t.units.references.proposeExternalLink}
					/>
					<DialogBody>
						<form className="grid gap-4" id={`entity-external-link-${entityId}`} onSubmit={submit}>
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
								<FieldLabel>{t.units.references.externalUrl}</FieldLabel>
								<Input
									onChange={(event) => setUrl(event.currentTarget.value)}
									placeholder={t.units.references.urlPlaceholder}
									required
									type="url"
									value={url}
								/>
							</Field>
							<RequestFailure error={create.error} fallback={t.errors.unknown} />
						</form>
					</DialogBody>
					<DialogFooter>
						<Button
							disabled={create.isPending}
							onClick={() => setDialogOpen(false)}
							type="button"
							variant="quiet"
						>
							{t.units.relationshipManagement.cancel}
						</Button>
						<Button
							disabled={!source || !url.trim()}
							form={`entity-external-link-${entityId}`}
							isLoading={create.isPending}
							type="submit"
						>
							{t.units.references.proposeExternalLink}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</section>
	);
}
