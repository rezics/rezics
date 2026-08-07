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
	Badge,
	Button,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	EntityPicker,
	Field,
	FieldLabel,
	IdentityAvatar,
	Input,
	Popover,
	PopoverClose,
	PopoverContent,
	PopoverTrigger,
	cn,
	toast,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowBigDownIcon, ArrowBigUpIcon, ExternalLink, Plus } from "lucide-react";
import { type FormEvent, useState } from "react";

import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";
import { useDevelopmentPreviewAccess } from "@/features/preview-access/components/development-preview-boundary";
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
	const score = toFiniteApiNumber(link.score) ?? 0;
	const voteCount = toNonNegativeApiInteger(link.voteCount);
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
						aria-pressed={link.viewerVote === 1}
						className={cn(link.viewerVote === 1 && "text-primary hover:text-primary")}
						disabled={busy}
						onClick={() => (link.viewerVote === 1 ? onClear() : onVote(1))}
						size="sm"
						type="button"
						variant="quiet"
					>
						<ArrowBigUpIcon
							aria-hidden
							fill={link.viewerVote === 1 ? "currentColor" : "none"}
						/>
						{t.units.references.support}
					</Button>
					<Button
						aria-pressed={link.viewerVote === -1}
						className={cn(link.viewerVote === -1 && "text-info hover:text-info")}
						disabled={busy}
						onClick={() => (link.viewerVote === -1 ? onClear() : onVote(-1))}
						size="sm"
						type="button"
						variant="quiet"
					>
						<ArrowBigDownIcon
							aria-hidden
							fill={link.viewerVote === -1 ? "currentColor" : "none"}
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
	const { t } = useTranslation(["ui", "units"]);
	const title = useChineseContentText(
		link.sourceEntity.title ?? t.ui.unnamed,
		link.sourceEntity.title ? link.sourceEntity.language : null,
	);
	const summary = useChineseContentText(
		link.sourceEntity.summary ?? "",
		link.sourceEntity.language,
	);
	const score = toFiniteApiNumber(link.score) ?? 0;
	const avatarFallback = title.trim().slice(0, 1).toUpperCase() || "#";
	const variant =
		link.viewerVote === 1 ? "success" : link.viewerVote === -1 ? "destructive" : "outline";

	return (
		<Badge className="max-w-full gap-0 overflow-visible p-0" pill variant={variant}>
			<Popover
				autoFocus={false}
				closeOnEscape
				closeOnInteractOutside
				modal={false}
				positioning={{ placement: "bottom-start", gutter: 8 }}
			>
				<PopoverTrigger asChild>
					<button
						className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full px-2.5 py-1.5 outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring/40"
						type="button"
					>
						<IdentityAvatar
							avatar={link.sourceEntity.avatar}
							className="size-5 text-[0.625rem]"
							fallback={avatarFallback}
							size="sm"
						/>
						<span className="min-w-0 truncate">{title}</span>
						<span className="shrink-0 tabular-nums text-[0.6875rem] opacity-75">
							{score}
						</span>
					</button>
				</PopoverTrigger>
				<PopoverContent className="grid w-[min(22rem,calc(100vw-2rem))] gap-4 p-(--space)">
					<div className="flex min-w-0 items-start gap-3">
						<IdentityAvatar
							avatar={link.sourceEntity.avatar}
							className="size-11 shrink-0"
							fallback={avatarFallback}
						/>
						<div className="min-w-0">
							<p className="truncate font-semibold">{title}</p>
							<div className="mt-1 flex flex-wrap gap-1">
								<Badge variant={link.accepted ? "secondary" : "outline"}>
									{link.accepted
										? t.units.references.accepted
										: t.units.references.candidate}
								</Badge>
								{link.pinned ? (
									<Badge variant="secondary">{t.units.references.pinned}</Badge>
								) : null}
							</div>
						</div>
					</div>
					{summary ? (
						<p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
							{summary}
						</p>
					) : null}
					<PopoverClose asChild>
						<a
							className="inline-flex min-w-0 items-center gap-1.5 break-all text-sm text-link hover:text-link-hover hover:underline"
							href={link.url}
							rel="ugc nofollow noreferrer"
							target="_blank"
						>
							<span>{link.url}</span>
							<ExternalLink aria-hidden className="size-3.5 shrink-0" />
						</a>
					</PopoverClose>
					<ExternalLinkVoteControls
						busy={busy}
						canVote={canVote}
						link={link}
						onClear={onClear}
						onVote={onVote}
					/>
				</PopoverContent>
			</Popover>
		</Badge>
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
					<h2 className="font-heading text-xl font-bold">
						{t.units.detail.externalLinks}
					</h2>
					<p className="text-sm text-muted-foreground">
						{t.entities.externalLinksDescription}
					</p>
				</div>
				{developmentPreview.state === "allowed" ? (
					<Button
						onClick={() => setDialogOpen(true)}
						size="sm"
						type="button"
						variant="outline"
					>
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
						<form
							className="grid gap-4"
							id={`entity-external-link-${entityId}`}
							onSubmit={submit}
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
