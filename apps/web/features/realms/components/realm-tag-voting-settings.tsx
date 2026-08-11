"use client";

import {
	type GetApiRealmsByRealmIdStatus200,
	getApiRealmsByRealmIdTagContexts,
	getApiRealmsByRealmIdTagContextsQueryKey,
	useDeleteApiRealmsByRealmIdTagsByTagIdContext,
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
	QueryFailure,
	QueryPending,
	Switch,
} from "@rezics/ui";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowRightIcon, BookOpenTextIcon, PlusIcon, TagsIcon, Trash2Icon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { postHref } from "@/features/posts/url";
import { tagDetailHref } from "@/features/tags/routing/tag-links";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { isRealmTagContextComposerAvailable } from "../model/realm-content-composer";
import { invalidateRealmDetails } from "../query";
import { realmContentCreateHref } from "../routing/realm-content-create-route";

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
			{realm.capabilities.canManageTagContexts ? (
				<RealmTagContextRelationshipList createHref={tagContextCreateHref} realmId={realm.id} />
			) : null}
		</div>
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
