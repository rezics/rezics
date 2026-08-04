"use client";

import {
	getApiPostsByPostIdReplies,
	getApiPostsByPostIdRepliesQueryKey,
	usePatchApiPostsByPostIdRepliesByReplyPostId,
	usePostApiPostsByPostIdReplies,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDownIcon, MessageCircleIcon, MessagesSquareIcon } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import {
	useCallback,
	useEffect,
	useMemo,
	useState,
	type ComponentProps,
	type FormEvent,
} from "react";

import {
	Button,
	cn,
	FieldGroup,
	IdentityAvatar,
	Skeleton,
	Spinner,
	ThreadBranch,
} from "@rezics/ui";
import { SignInButton } from "@/features/auth/auth-portal";
import { DraftContentLanguageField } from "@/features/content-languages/components/draft-content-language-field";
import { useFormDraftContentLanguage } from "@/features/content-languages/hooks/use-form-draft-content-language";
import { portableTextDraftContentLanguageSample } from "@/features/content-languages/model/draft-content-language-sample";
import { ConnectedFeedEngagementBar } from "@/features/content-feed/components/feed-card-actions";
import type { FeedActionPolicy } from "@/features/content-feed/model/feed-action-policy";
import {
	PortableTextEditor,
	preloadPortableTextEditor,
} from "@/features/editor/portable-text-editor";
import { RealmRulesAcknowledgementPrompt } from "@/features/realms/components/realm-rules-acknowledgement-prompt";
import { useRealmRulesAcknowledgement } from "@/features/realms/hooks/use-realm-rules-acknowledgement";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { RequestFailure } from "@/i18n/request-failure";
import { readPortableText, writePortableText } from "@/lib/block";
import { LocalizedPortableTextContent } from "@/features/content-language-display/localized-portable-text-content";
import { formatRelativeTime } from "@/features/content-feed/model/format-relative-time";
import {
	buildReplyPostTree,
	flattenReplyPostTree,
	type ReplyPost,
	type ReplyPostTreeNode,
} from "./reply-tree";
import { PostOverflowMenu } from "./components/post-overflow-menu";
import { invalidatePostQueries } from "./query";
import { ReplyAttributionLinks } from "./attribution-list";
import { postHref } from "./url";

const ReplyEngagementPolicy = {
	discussion: "none",
	primary: "none",
} as const satisfies FeedActionPolicy;

const EmptyPostPublisherUnitIds: ReadonlySet<string> = new Set();

const editorPreloadIntentHandlers = {
	onFocus: preloadPortableTextEditor,
	onPointerDown: preloadPortableTextEditor,
	onPointerEnter: preloadPortableTextEditor,
} satisfies Pick<ComponentProps<"button">, "onFocus" | "onPointerDown" | "onPointerEnter">;

export function ReplyPostThread({
	rootPostId,
	parentPostId,
	realmId,
	canReply,
	postPublisherUnitIds = EmptyPostPublisherUnitIds,
	signInDestination,
}: {
	rootPostId: string;
	parentPostId?: string;
	realmId?: string;
	canReply: boolean;
	postPublisherUnitIds?: ReadonlySet<string>;
	signInDestination?: string;
}) {
	const { t } = useTranslation(["actions", "posts", "ui"]);
	const localizationLanguages = useLocalizationLanguages();
	const baseQuery = {
		limit: 25,
		localizationLanguages,
		...(realmId ? { realmId } : {}),
		...(parentPostId ? { parentPostId } : {}),
	};
	const replies = useInfiniteQuery({
		queryKey: [
			...getApiPostsByPostIdRepliesQueryKey({
				path: { postId: rootPostId },
				query: baseQuery,
			}),
			"infinite",
		] as const,
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await getApiPostsByPostIdReplies({
				path: { postId: rootPostId },
				query: { ...baseQuery, ...(pageParam ? { cursor: pageParam } : {}) },
				signal,
			});
			return data;
		},
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
	});
	const { data: session } = useHydratedSession();
	const [createdReplies, setCreatedReplies] = useState<ReplyPost[]>([]);
	const addCreatedReply = useCallback((reply: ReplyPost) => {
		setCreatedReplies((current) => [...current.filter(({ id }) => id !== reply.id), reply]);
	}, []);
	const visibleTree = useMemo(
		() =>
			buildReplyPostTree([
				...(replies.data?.pages.flatMap((page) => page.items) ?? []),
				...createdReplies.filter((reply) => reply.parentPostId === (parentPostId ?? null)),
			]),
		[createdReplies, parentPostId, replies.data?.pages],
	);

	return (
		<section className="flex min-w-0 flex-col gap-4" id="replies">
			<h2 className="font-heading font-bold text-xl">{t.posts.replies}</h2>
			{!canReply ? (
				<p className="text-muted-foreground text-sm">{t.posts.replyingLocked}</p>
			) : session ? (
				<ReplyPostComposer
					rootPostId={rootPostId}
					parentPostId={parentPostId}
					realmId={realmId}
					action={t.ui.postReply}
					initiallyExpanded={false}
					onReplyCreated={addCreatedReply}
				/>
			) : (
				<SignInButton
					className="h-11 w-full justify-start rounded-xl text-muted-foreground"
					destination={
						signInDestination ??
						postHref(
							parentPostId ?? rootPostId,
							realmId ? { kind: "realm", realmId } : undefined,
						)
					}
					variant="outline"
				>
					{t.posts.signInToReply}
				</SignInButton>
			)}
			{replies.isPending ? (
				<div className="flex flex-col gap-3">
					{Array.from({ length: 3 }, (_, index) => (
						<div className="flex gap-2 py-3" key={index}>
							<Skeleton className="size-6 shrink-0 rounded-full" />
							<div className="grid flex-1 gap-3">
								<Skeleton className="h-4 w-40 rounded-md" />
								<Skeleton className="h-16 rounded-lg" />
							</div>
						</div>
					))}
				</div>
			) : replies.isError && !replies.data ? (
				<div className="flex flex-col items-start gap-3">
					<RequestFailure error={replies.error} />
					<Button variant="outline" size="sm" onClick={() => void replies.refetch()}>
						{t.actions.retry}
					</Button>
				</div>
			) : visibleTree.length ? (
				<div className="flex min-w-0 flex-col">
					{visibleTree.map((reply) => (
						<ReplyPostNode
							key={reply.id}
							reply={reply}
							rootPostId={rootPostId}
							realmId={realmId}
							signedIn={Boolean(session)}
							topLevel
							createdReplies={createdReplies}
							localizationLanguages={localizationLanguages}
							onReplyCreated={addCreatedReply}
							postPublisherUnitIds={postPublisherUnitIds}
						/>
					))}
					{replies.isFetchNextPageError ? (
						<div className="flex flex-col items-center gap-2">
							<RequestFailure error={replies.error} />
							<Button
								onClick={() => void replies.fetchNextPage()}
								size="sm"
								variant="outline"
							>
								{t.actions.retry}
							</Button>
						</div>
					) : replies.hasNextPage ? (
						<Button
							className="self-center"
							disabled={replies.isFetchingNextPage}
							onClick={() => void replies.fetchNextPage()}
							variant="outline"
						>
							{replies.isFetchingNextPage && <Spinner data-icon="inline-start" />}
							{t.actions.loadMore}
						</Button>
					) : null}
				</div>
			) : (
				<p className="text-muted-foreground text-sm">{t.posts.noReplies}</p>
			)}
		</section>
	);
}

function ReplyPostNode({
	reply,
	rootPostId,
	realmId,
	signedIn,
	topLevel = false,
	createdReplies,
	localizationLanguages,
	onReplyCreated,
	postPublisherUnitIds,
}: {
	reply: ReplyPostTreeNode;
	rootPostId: string;
	realmId?: string;
	signedIn: boolean;
	topLevel?: boolean;
	createdReplies: readonly ReplyPost[];
	localizationLanguages: ReturnType<typeof useLocalizationLanguages>;
	onReplyCreated: (reply: ReplyPost) => void;
	postPublisherUnitIds: ReadonlySet<string>;
}) {
	const { locale, t } = useTranslation(["actions", "posts", "ui"]);
	const queryClient = useQueryClient();
	const update = usePatchApiPostsByPostIdRepliesByReplyPostId();
	const childBaseQuery = {
		limit: 25,
		localizationLanguages,
		...(realmId ? { realmId } : {}),
		parentPostId: reply.id,
	};
	const childReplies = useInfiniteQuery({
		queryKey: [
			...getApiPostsByPostIdRepliesQueryKey({
				path: { postId: rootPostId },
				query: childBaseQuery,
			}),
			"infinite",
			"continuation",
			reply.childEndCursor ?? "start",
		] as const,
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await getApiPostsByPostIdReplies({
				path: { postId: rootPostId },
				query: {
					...childBaseQuery,
					...(pageParam ? { cursor: pageParam } : {}),
				},
				signal,
			});
			return data;
		},
		initialPageParam: reply.childEndCursor ?? "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
		enabled: false,
	});
	const [editing, setEditing] = useState(false);
	const [replying, setReplying] = useState(false);
	const [descendantsVisible, setDescendantsVisible] = useState(true);
	const [body, setBody] = useState<PortableTextValue>([]);
	const canEdit =
		reply.capabilities.canEdit && reply.status !== "deleted" && Boolean(reply.latestRevisionId);
	const replyHref = postHref(reply.id, realmId ? { kind: "realm", realmId } : undefined);
	const primaryAttribution =
		reply.attributions.find((attribution) => attribution.role === "publisher") ??
		reply.attributions[0];
	const primaryName = primaryAttribution?.creditedUnit.title ?? t.posts.unknownAttribution;
	const primaryInitials = Array.from(primaryName.trim())[0]?.toLocaleUpperCase() ?? primaryName;
	const childTree = useMemo(
		() =>
			buildReplyPostTree([
				...flattenReplyPostTree(reply.children),
				...(childReplies.data?.pages.flatMap((page) => page.items) ?? []),
				...createdReplies.filter((created) => created.parentPostId === reply.id),
			]),
		[childReplies.data?.pages, createdReplies, reply.children, reply.id],
	);
	const hasMoreChildren = childReplies.data ? childReplies.hasNextPage : reply.hasMoreChildren;
	const hasDescendants = childTree.length > 0 || hasMoreChildren;

	function save(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!reply.latestRevisionId) return;
		update.mutate(
			{
				path: { postId: rootPostId, replyPostId: reply.id },
				body: {
					language: reply.language,
					body: writePortableText(body, reply.body),
					baseRevisionId: reply.latestRevisionId,
				},
			},
			{
				onSuccess: async () => {
					await invalidatePostQueries(queryClient, rootPostId, reply.id);
					setEditing(false);
				},
			},
		);
	}

	return (
		<article
			aria-label={primaryName}
			className={cn(
				"relative min-w-0 py-3",
				topLevel && "border-border-weak border-t first:border-t-0",
			)}
		>
			<ThreadBranch
				{...(hasDescendants
					? {
							collapseDescendantsLabel: t.posts.hideChildReplies,
							descendants: (
								<>
									{childTree.map((child) => (
										<ReplyPostNode
											key={child.id}
											reply={child}
											rootPostId={rootPostId}
											realmId={realmId}
											signedIn={signedIn}
											createdReplies={createdReplies}
											localizationLanguages={localizationLanguages}
											onReplyCreated={onReplyCreated}
											postPublisherUnitIds={postPublisherUnitIds}
										/>
									))}
									{childReplies.isError ? (
										<RequestFailure error={childReplies.error} />
									) : null}
									{hasMoreChildren ? (
										<Button
											className="mt-1 w-fit"
											disabled={childReplies.isFetching}
											onClick={() =>
												void (childReplies.data
													? childReplies.fetchNextPage()
													: childReplies.refetch())
											}
											size="xs"
											variant="outline"
										>
											{childReplies.isFetching ? (
												<Spinner data-icon="inline-start" />
											) : (
												<MessagesSquareIcon
													aria-hidden
													data-icon="inline-start"
												/>
											)}
											{childReplies.isError
												? t.actions.retry
												: t.actions.loadMore}
											<ChevronDownIcon aria-hidden data-icon="inline-end" />
										</Button>
									) : null}
								</>
							),
							descendantsVisible,
							expandDescendantsLabel: t.posts.showChildReplies,
							hasDescendants: true as const,
							onDescendantsVisibleChange: setDescendantsVisible,
						}
					: { hasDescendants: false as const })}
				content={
					<div className="min-w-0">
						{reply.status === "deleted" ? (
							<p className="mt-2 text-muted-foreground text-sm">
								{t.posts.deletedReply}
							</p>
						) : editing ? (
							<form className="mt-3" onSubmit={save}>
								<FieldGroup>
									<PortableTextEditor
										ariaLabel={t.posts.replyBody}
										onChange={setBody}
										value={body}
									/>
									<RequestFailure error={update.error} />
									<div className="flex flex-wrap gap-2">
										<Button
											variant="solid"
											type="submit"
											size="sm"
											disabled={!body.length || update.isPending}
										>
											{update.isPending && (
												<Spinner data-icon="inline-start" />
											)}
											{t.ui.save}
										</Button>
										<Button
											type="button"
											size="sm"
											variant="quiet"
											onClick={() => {
												setBody([]);
												setEditing(false);
											}}
										>
											{t.posts.cancel}
										</Button>
									</div>
								</FieldGroup>
							</form>
						) : (
							<div className="prose prose-sm mt-2 max-w-none">
								<LocalizedPortableTextContent
									language={reply.language}
									value={readPortableText(reply.body)}
									variant="compact"
								/>
							</div>
						)}
						{reply.status !== "deleted" && (
							<ConnectedFeedEngagementBar
								actions={
									signedIn && reply.capabilities.canReply ? (
										<Button
											{...editorPreloadIntentHandlers}
											className="min-h-8"
											onClick={() => {
												preloadPortableTextEditor();
												setReplying((value) => !value);
											}}
											size="sm"
											type="button"
											variant="secondary"
										>
											<MessageCircleIcon
												aria-hidden
												data-icon="inline-start"
											/>
											{t.posts.reply}
										</Button>
									) : null
								}
								href={replyHref}
								itemId={reply.id}
								overflowMenu={
									<PostOverflowMenu
										availableLanguages={reply.availableLanguages}
										contentHref={replyHref}
										currentLanguage={reply.language}
										editAction={
											canEdit
												? {
														kind: "command",
														onSelect: () => {
															preloadPortableTextEditor();
															setBody(readPortableText(reply.body));
															setEditing(true);
														},
													}
												: undefined
										}
										postId={reply.id}
										realmId={realmId}
									/>
								}
								policy={ReplyEngagementPolicy}
								realmId={realmId}
								showErrors={false}
							/>
						)}
						{replying && reply.capabilities.canReply && (
							<ReplyPostComposer
								rootPostId={rootPostId}
								parentPostId={reply.id}
								realmId={realmId}
								action={t.posts.reply}
								initiallyExpanded
								onComplete={() => setReplying(false)}
								onCancel={() => setReplying(false)}
								onReplyCreated={onReplyCreated}
							/>
						)}
					</div>
				}
				header={
					<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
						<ReplyAttributionLinks
							attributions={reply.attributions}
							className="font-semibold hover:underline"
							emptyLabel={t.posts.unknownAttribution}
							postPublisherUnitIds={postPublisherUnitIds}
							publisherLabel={t.posts.publisher}
						/>
						<Link
							className="text-muted-foreground text-xs hover:underline"
							href={postHref(
								reply.id,
								realmId ? { kind: "realm", realmId } : undefined,
							)}
						>
							{formatRelativeTime(reply.createdAt, locale.target)}
						</Link>
					</div>
				}
				marker={
					<IdentityAvatar
						avatar={primaryAttribution?.creditedUnit.avatar}
						className="size-6 text-[0.625rem]"
						fallback={primaryInitials}
						size="sm"
					/>
				}
			/>
		</article>
	);
}

function ReplyPostComposer({
	rootPostId,
	parentPostId,
	realmId,
	action,
	initiallyExpanded,
	onComplete,
	onCancel,
	onReplyCreated,
}: {
	rootPostId: string;
	parentPostId?: string;
	realmId?: string;
	action: string;
	initiallyExpanded: boolean;
	onComplete?: () => void;
	onCancel?: () => void;
	onReplyCreated: (reply: ReplyPost) => void;
}) {
	const { t } = useTranslation(["actions", "posts", "ui"]);
	const queryClient = useQueryClient();
	const create = usePostApiPostsByPostIdReplies();
	const [expanded, setExpanded] = useState(initiallyExpanded);
	const [body, setBody] = useState<PortableTextValue>([]);
	const [editorKey, setEditorKey] = useState(0);
	const language = useFormDraftContentLanguage([], portableTextDraftContentLanguageSample(body));
	const rulesAcknowledgement = useRealmRulesAcknowledgement(realmId ? [realmId] : []);

	useEffect(() => {
		if (initiallyExpanded || expanded) return;
		const preload = () => preloadPortableTextEditor();

		if ("requestIdleCallback" in window) {
			const idleCallbackId = window.requestIdleCallback(preload, { timeout: 2_000 });
			return () => window.cancelIdleCallback(idleCallbackId);
		}

		const timeoutId = setTimeout(preload, 1_000);
		return () => clearTimeout(timeoutId);
	}, [expanded, initiallyExpanded]);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const contentLanguage = await language.resolveLanguage(event.currentTarget);
		try {
			await rulesAcknowledgement.run(async () => {
				const createdReply = await create.mutateAsync({
					path: { postId: rootPostId },
					body: {
						...(parentPostId ? { parentPostId } : {}),
						...(realmId ? { realmId } : {}),
						language: contentLanguage,
						body: writePortableText(body),
					},
				});
				onReplyCreated(createdReply);
				await invalidatePostQueries(queryClient, rootPostId);
				setBody([]);
				language.reset();
				setEditorKey((value) => value + 1);
				setExpanded(false);
				onComplete?.();
			});
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<>
			{expanded ? (
				<form className="mt-2" onSubmit={(event) => void submit(event)}>
					<FieldGroup>
						<PortableTextEditor
							ariaLabel={t.posts.replyBody}
							key={editorKey}
							onChange={setBody}
							value={body}
						/>
						<DraftContentLanguageField controller={language.controller} />
						<RequestFailure error={create.error} />
						<div className="flex flex-wrap gap-2">
							<Button
								variant="solid"
								type="submit"
								className="w-fit"
								size="sm"
								disabled={!body.length || create.isPending}
							>
								{create.isPending && <Spinner data-icon="inline-start" />}
								{action}
							</Button>
							<Button
								onClick={() => {
									setBody([]);
									setExpanded(false);
									onCancel?.();
								}}
								size="sm"
								type="button"
								variant="quiet"
							>
								{t.posts.cancel}
							</Button>
						</div>
					</FieldGroup>
				</form>
			) : (
				<button
					{...editorPreloadIntentHandlers}
					className="flex h-11 w-full items-center rounded-xl border border-input bg-background px-4 text-start text-muted-foreground text-sm shadow-sm/5 outline-none transition-colors hover:bg-surface-hover focus-visible:ring-[3px] focus-visible:ring-ring/32"
					onClick={() => {
						preloadPortableTextEditor();
						setExpanded(true);
					}}
					type="button"
				>
					{t.posts.openReplyComposer}
				</button>
			)}
			<RealmRulesAcknowledgementPrompt controller={rulesAcknowledgement} intent="publish" />
		</>
	);
}
