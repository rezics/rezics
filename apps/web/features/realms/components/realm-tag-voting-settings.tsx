"use client";

import {
	type GetApiRealmsByRealmIdStatus200,
	getApiRealmsByRealmIdTagContexts,
	getApiRealmsByRealmIdTagContextsQueryKey,
	getApiRealmsByRealmIdTagPathsQueryKey,
	getApiTagPathsSearch,
	useDeleteApiRealmsByRealmIdTagPathsByPathIdVote,
	useDeleteApiRealmsByRealmIdTagsByTagIdContext,
	useGetApiRealmsByRealmIdTagPaths,
	usePutApiRealmsByRealmIdTagPathPolicy,
	usePutApiRealmsByRealmIdTagPathSensesBySenseId,
	usePutApiRealmsByRealmIdTagPathsByPathIdVote,
	usePutApiRealmsByRealmIdTagVoting,
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
	Badge,
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
	EntityPicker,
	NativeSelect,
	NativeSelectOption,
	QueryFailure,
	QueryPending,
	Switch,
	type EntitySearch,
} from "@rezics/ui";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
	ArrowRightIcon,
	BookOpenTextIcon,
	ChevronRightIcon,
	PlusIcon,
	TagsIcon,
	Trash2Icon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { postHref } from "@/features/posts/url";
import { tagDetailHref } from "@/features/tags/routing/tag-links";
import { tagPathHref } from "@/features/tags/routing/tag-links";
import { TagVoteControls } from "@/features/tags/components/tag-vote-controls";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { isRealmTagContextComposerAvailable } from "../model/realm-content-composer";
import { invalidateRealmDetails } from "../query";
import { realmContentCreateHref } from "../routing/realm-content-create-route";
import { toFiniteApiNumber, toNonNegativeApiInteger } from "@/lib/api-number";

export function RealmTagVotingSettings({
	realm,
}: {
	readonly realm: GetApiRealmsByRealmIdStatus200;
}) {
	const { t } = useTranslation("realms");
	const queryClient = useQueryClient();
	const update = usePutApiRealmsByRealmIdTagVoting();
	const pendingValue = update.isPending ? update.variables?.body.enabled : undefined;
	const tagContextCreateHref =
		!update.isPending &&
		isRealmTagContextComposerAvailable({
			tagVotingEnabled: realm.realmTagVotingEnabled,
			canManageTagContexts: realm.capabilities.canManageTagContexts,
		})
			? realmContentCreateHref(realm, "tag-context")
			: undefined;

	async function setEnabled(enabled: boolean) {
		if (!realm.capabilities.canUpdateTagVoting) return;
		try {
			await update.mutateAsync({
				path: { realmId: realm.id },
				body: { enabled },
			});
			await invalidateRealmDetails(queryClient, realm.id);
		} catch {
			// The typed mutation error is rendered below.
		}
	}

	return (
		<div className="grid gap-6">
			<Field className="rounded-xl border bg-muted/24 p-4" orientation="horizontal">
				<FieldContent>
					<FieldLabel>{t.tagVotingSettings.enabled}</FieldLabel>
					<FieldDescription>{t.tagVotingSettings.enabledDescription}</FieldDescription>
				</FieldContent>
				<Switch
					aria-label={t.tagVotingSettings.enabled}
					checked={pendingValue ?? realm.realmTagVotingEnabled}
					disabled={!realm.capabilities.canUpdateTagVoting || update.isPending}
					onCheckedChange={({ checked }) => void setEnabled(checked === true)}
				/>
			</Field>
			<RequestFailure error={update.error} />
			<RealmTagPathAuthority realm={realm} />
			{realm.capabilities.canManageTagContexts ? (
				<RealmTagContextRelationshipList createHref={tagContextCreateHref} realmId={realm.id} />
			) : null}
		</div>
	);
}

function RealmTagPathAuthority({ realm }: { readonly realm: GetApiRealmsByRealmIdStatus200 }) {
	const { t } = useTranslation(["realms", "tags", "ui"]);
	const queryClient = useQueryClient();
	const localizationLanguages = useLocalizationLanguages();
	const [selectedPath, setSelectedPath] = useState<{ id: string; label: string }>();
	const senseIdBySelectionId = useRef(new Map<string, string>());
	const queryInput = {
		path: { realmId: realm.id },
		query: { localizationLanguages, limit: 100 },
	} as const;
	const query = useGetApiRealmsByRealmIdTagPaths(queryInput);
	const adoptSense = usePutApiRealmsByRealmIdTagPathSensesBySenseId();
	const vote = usePutApiRealmsByRealmIdTagPathsByPathIdVote();
	const clearVote = useDeleteApiRealmsByRealmIdTagPathsByPathIdVote();
	const updatePolicy = usePutApiRealmsByRealmIdTagPathPolicy();
	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: getApiRealmsByRealmIdTagPathsQueryKey({ path: { realmId: realm.id } }),
		});
	const pathSearch = useMemo<EntitySearch>(
		() => async (_index, searchQuery, signal) => {
			const response = await getApiTagPathsSearch({
				query: { q: searchQuery, limit: 20, localizationLanguages },
				signal,
				throwOnError: true,
			});
			return response.data.items.flatMap((item) => {
				if (item.selection !== "path_sense" || !item.pathId || !item.senseId) return [];
				const expressionLabel = item.expression.components
					.filter(({ componentKind }) => componentKind === "required")
					.map(({ title }) => title ?? t.tags.unnamedTag)
					.join(" · ");
				const pathLabel = item.members
					.map((member) => member.title ?? t.tags.unnamedTag)
					.join(" › ");
				const id = `sense:${item.senseId}`;
				senseIdBySelectionId.current.set(id, item.senseId);
				return [
					{
						id,
						label: `${expressionLabel} — ${pathLabel}`,
					},
				];
			});
		},
		[localizationLanguages, t.tags.unnamedTag],
	);
	const policy = updatePolicy.variables?.body ?? query.data?.policy;

	async function setPolicy(
		dimension: "fitFallbackPolicy" | "spoilerFallbackPolicy",
		value: "inherit" | "isolate",
	) {
		if (!policy || !realm.capabilities.canUpdateTagVoting) return;
		await updatePolicy.mutateAsync({
			path: { realmId: realm.id },
			body: { ...policy, [dimension]: value },
		});
		await invalidate();
	}

	async function adoptSelectedPath() {
		if (!selectedPath) return;
		const senseId = senseIdBySelectionId.current.get(selectedPath.id);
		if (!senseId) return;
		await adoptSense.mutateAsync({
			path: { realmId: realm.id, senseId },
		});
		setSelectedPath(undefined);
		await invalidate();
	}

	return (
		<Card appearance="outlined">
			<CardHeader>
				<CardTitle>{t.realms.tagVotingSettings.pathAuthorityTitle}</CardTitle>
				<CardDescription>{t.realms.tagVotingSettings.pathAuthorityDescription}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-5">
				{query.isPending ? <QueryPending /> : null}
				{query.isError ? (
					<QueryFailure error={query.error} retry={() => void query.refetch()} />
				) : null}
				{policy ? (
					<div className="grid gap-4 sm:grid-cols-2">
						<Field>
							<FieldLabel>{t.realms.tagVotingSettings.fitFallback}</FieldLabel>
							<NativeSelect
								disabled={!realm.capabilities.canUpdateTagVoting || updatePolicy.isPending}
								onChange={(event) => {
									const value = event.currentTarget.value;
									if (value === "inherit" || value === "isolate")
										void setPolicy("fitFallbackPolicy", value);
								}}
								value={policy.fitFallbackPolicy}
							>
								<NativeSelectOption value="inherit">
									{t.realms.tagVotingSettings.fallbackInherit}
								</NativeSelectOption>
								<NativeSelectOption value="isolate">
									{t.realms.tagVotingSettings.fallbackIsolate}
								</NativeSelectOption>
							</NativeSelect>
						</Field>
						<Field>
							<FieldLabel>{t.realms.tagVotingSettings.spoilerFallback}</FieldLabel>
							<NativeSelect
								disabled={!realm.capabilities.canUpdateTagVoting || updatePolicy.isPending}
								onChange={(event) => {
									const value = event.currentTarget.value;
									if (value === "inherit" || value === "isolate")
										void setPolicy("spoilerFallbackPolicy", value);
								}}
								value={policy.spoilerFallbackPolicy}
							>
								<NativeSelectOption value="inherit">
									{t.realms.tagVotingSettings.fallbackInherit}
								</NativeSelectOption>
								<NativeSelectOption value="isolate">
									{t.realms.tagVotingSettings.fallbackIsolate}
								</NativeSelectOption>
							</NativeSelect>
						</Field>
					</div>
				) : null}
				{realm.capabilities.canManageTags ? (
					<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
						<EntityPicker
							ariaLabel={t.realms.tagVotingSettings.adoptPath}
							index="tags"
							maxLength={500}
							onChange={setSelectedPath}
							placeholder={t.realms.tagVotingSettings.adoptPath}
							search={pathSearch}
							value={selectedPath}
						/>
						<Button
							disabled={!selectedPath}
							isLoading={adoptSense.isPending}
							onClick={() => void adoptSelectedPath()}
						>
							{t.realms.tagVotingSettings.adoptPath}
						</Button>
					</div>
				) : null}
				{query.data?.items.length === 0 ? (
					<p className="text-sm text-muted-foreground">{t.realms.tagVotingSettings.pathsEmpty}</p>
				) : (
					<div className="grid gap-3">
						{query.data?.items.map((item) => (
							<div className="grid gap-3 rounded-xl border p-4" key={item.pathId}>
								<ol className="flex flex-wrap items-center gap-1.5">
									{item.members.map((member, index) => (
										<li className="contents" key={member.nodeId}>
											{index ? <ChevronRightIcon className="size-4 text-muted-foreground" /> : null}
											{member.nodeKind === "concept" ? (
												<Link href={tagDetailHref(member.nodeId)}>
													{member.title ?? t.tags.unnamedTag}
												</Link>
											) : (
												<span>{member.title ?? t.tags.paths.memberFallback}</span>
											)}
										</li>
									))}
								</ol>
								{item.senses.length ? (
									<div className="flex flex-wrap items-center gap-2">
										<span className="text-xs text-muted-foreground">
											{t.tags.expressions.title}
										</span>
										{item.senses.map((sense) => (
											<Badge key={sense.senseId} variant="secondary">
												{sense.expression.components
													.filter(({ componentKind }) => componentKind === "required")
													.map(({ title }) => title ?? t.tags.unnamedTag)
													.join(" · ")}
											</Badge>
										))}
									</div>
								) : null}
								<div className="flex flex-wrap items-center justify-between gap-3">
									<TagVoteControls
										canVote
										isPending={
											(vote.isPending && vote.variables?.path.pathId === item.pathId) ||
											(clearVote.isPending && clearVote.variables?.path.pathId === item.pathId)
										}
										onClear={() =>
											clearVote.mutate(
												{ path: { realmId: realm.id, pathId: item.pathId } },
												{ onSuccess: () => void invalidate() },
											)
										}
										onVote={(value) =>
											vote.mutate(
												{
													path: { realmId: realm.id, pathId: item.pathId },
													body: { value },
												},
												{ onSuccess: () => void invalidate() },
											)
										}
										score={toFiniteApiNumber(item.score) ?? 0}
										viewerVote={item.viewerVote}
										voteCount={toNonNegativeApiInteger(item.voteCount)}
									/>
									<Button asChild size="sm" variant="quiet">
										<Link href={tagPathHref(item.pathId)}>{t.tags.paths.details}</Link>
									</Button>
								</div>
							</div>
						))}
					</div>
				)}
				<RequestFailure
					error={adoptSense.error ?? vote.error ?? clearVote.error ?? updatePolicy.error}
				/>
			</CardContent>
		</Card>
	);
}

function RealmTagContextRelationshipList({
	realmId,
	createHref,
}: {
	readonly realmId: string;
	readonly createHref?: string;
}) {
	const { t } = useTranslation("realms");
	const queryClient = useQueryClient();
	const localizationLanguages = useLocalizationLanguages();
	const [pendingRemoval, setPendingRemoval] = useState<{
		readonly tagId: string;
		readonly tagTitle: string | null;
	} | null>(null);
	const remove = useDeleteApiRealmsByRealmIdTagsByTagIdContext();
	const baseQuery = useMemo(() => ({ limit: 50, localizationLanguages }), [localizationLanguages]);
	const query = useInfiniteQuery({
		queryKey: getApiRealmsByRealmIdTagContextsQueryKey({
			path: { realmId },
			query: baseQuery,
		}),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await getApiRealmsByRealmIdTagContexts({
				path: { realmId },
				query: { ...baseQuery, ...(pageParam ? { cursor: pageParam } : {}) },
				signal,
				throwOnError: true,
			});
			return data;
		},
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
	});
	const items = query.data?.pages.flatMap((page) => page.items) ?? [];
	const scrollRef = useRef<HTMLDivElement>(null);
	const virtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => 76,
		overscan: 8,
	});
	const virtualItems = virtualizer.getVirtualItems();
	const lastVirtualIndex = virtualItems.at(-1)?.index;
	useEffect(() => {
		if (
			lastVirtualIndex !== undefined &&
			lastVirtualIndex >= items.length - 6 &&
			query.hasNextPage &&
			!query.isFetchingNextPage
		)
			void query.fetchNextPage();
	}, [
		items.length,
		lastVirtualIndex,
		query.fetchNextPage,
		query.hasNextPage,
		query.isFetchingNextPage,
	]);

	async function removeRelationship() {
		if (!pendingRemoval || remove.isPending) return;
		try {
			await remove.mutateAsync({
				path: { realmId, tagId: pendingRemoval.tagId },
			});
			await queryClient.invalidateQueries({
				queryKey: getApiRealmsByRealmIdTagContextsQueryKey({ path: { realmId } }),
			});
			setPendingRemoval(null);
		} catch {
			// The typed mutation error is rendered below.
		}
	}

	return (
		<>
			<Card appearance="outlined" className="overflow-hidden">
				<CardHeader>
					<CardTitle>{t.tagVotingSettings.relationshipsTitle}</CardTitle>
					<CardDescription>{t.tagVotingSettings.relationshipsDescription}</CardDescription>
					{createHref ? (
						<CardAction>
							<Button asChild variant="solid">
								<Link href={createHref}>
									<PlusIcon aria-hidden="true" />
									{t.tagContext.createTitle}
								</Link>
							</Button>
						</CardAction>
					) : null}
				</CardHeader>
				<CardContent>
					{query.isPending ? <QueryPending /> : null}
					{query.isError ? (
						<QueryFailure error={query.error} retry={() => void query.refetch()} />
					) : null}
					{query.data && items.length === 0 ? (
						<p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
							{t.tagVotingSettings.relationshipsEmpty}
						</p>
					) : null}
					{items.length ? (
						<div
							aria-label={t.tagVotingSettings.relationshipsListLabel}
							className="overflow-auto rounded-xl border"
							ref={scrollRef}
							role="list"
							style={{
								height: Math.min(Math.max(virtualizer.getTotalSize(), 76), 456),
							}}
						>
							<div className="relative" style={{ height: virtualizer.getTotalSize() }}>
								{virtualItems.map((virtualRow) => {
									const item = items[virtualRow.index];
									if (!item) return null;
									return (
										<div
											className="absolute inset-x-0 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-3 border-b px-4"
											key={`${item.realmId}:${item.tagId}`}
											role="listitem"
											style={{
												height: virtualRow.size,
												transform: `translateY(${virtualRow.start}px)`,
											}}
										>
											<RelationshipTarget
												href={item.tagReadable ? tagDetailHref(item.tagId) : undefined}
												icon={<TagsIcon className="size-4" />}
												label={item.tagTitle ?? t.tagVotingSettings.unavailableTag}
											/>
											<ArrowRightIcon aria-hidden="true" className="size-4 text-muted-foreground" />
											<RelationshipTarget
												href={
													item.contextReadable
														? postHref(item.contextPostId, {
																kind: "realm",
																realmId,
															})
														: undefined
												}
												icon={<BookOpenTextIcon className="size-4" />}
												label={item.contextTitle ?? t.tagVotingSettings.unavailableContext}
											/>
											<Button
												aria-label={t.tagVotingSettings.removeRelationshipLabel({
													tag: item.tagTitle ?? t.tagVotingSettings.unavailableTag,
												})}
												onClick={() =>
													setPendingRemoval({
														tagId: item.tagId,
														tagTitle: item.tagTitle,
													})
												}
												size="icon-sm"
												type="button"
												variant="quiet"
											>
												<Trash2Icon aria-hidden="true" />
											</Button>
										</div>
									);
								})}
							</div>
						</div>
					) : null}
					{query.isFetchingNextPage ? <QueryPending /> : null}
					<RequestFailure error={remove.error} />
				</CardContent>
			</Card>
			<AlertDialog
				onOpenChange={({ open }) => {
					if (!remove.isPending && !open) setPendingRemoval(null);
				}}
				open={pendingRemoval !== null}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t.tagVotingSettings.removeRelationshipTitle}</AlertDialogTitle>
						<AlertDialogDescription>
							{t.tagVotingSettings.removeRelationshipDescription({
								tag: pendingRemoval?.tagTitle ?? t.tagVotingSettings.unavailableTag,
							})}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={remove.isPending}>
							{t.tagVotingSettings.cancelRemoval}
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={remove.isPending}
							onClick={() => void removeRelationship()}
							variant="destructive"
						>
							{t.tagVotingSettings.removeRelationship}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

function RelationshipTarget({
	href,
	icon,
	label,
}: {
	readonly href?: string;
	readonly icon: ReactNode;
	readonly label: string;
}) {
	const content = (
		<>
			<span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted">{icon}</span>
			<span className="truncate font-medium text-sm">{label}</span>
		</>
	);
	return href ? (
		<Link className="flex min-w-0 items-center gap-2 hover:underline" href={href}>
			{content}
		</Link>
	) : (
		<span className="flex min-w-0 items-center gap-2 text-muted-foreground">{content}</span>
	);
}
