"use client";

import {
	GetApiPlatformUsersState,
	PutApiPlatformUsersByUserIdAccountStateRequestReasonEnum,
	getApiPlatformAccessProfilesByProfileIdQueryKey,
	getApiPlatformUsers,
	getApiPlatformUsersByUserIdQueryKey,
	getApiPlatformUsersByUserIdSessionsQueryKey,
	getApiPlatformUsersQueryKey,
	useDeleteApiPlatformUsersByUserIdSessions,
	useDeleteApiPlatformUsersByUserIdSessionsBySessionId,
	useGetApiAuditEvents,
	useGetApiPlatformAccessPolicy,
	useGetApiPlatformAccessProfilesByProfileId,
	useGetApiPlatformUsersByUserId,
	useGetApiPlatformUsersByUserIdSessions,
	usePutApiPlatformUsersByUserIdAccountState,
	type GetApiPlatformUsersState as PlatformUserState,
	type GetApiPlatformUsersStatus200,
	type PutApiPlatformUsersByUserIdAccountStateBody,
	type PutApiPlatformUsersByUserIdAccountStateRequestReasonEnum as AccountStateReason,
} from "@rezics/openapi-tanstack-query";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Field,
	FieldLabel,
	Input,
	NativeSelect,
	NativeSelectOption,
	QueryFailure,
	QueryPending,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	Textarea,
	cn,
} from "@rezics/ui";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowLeft, CheckCircle2, MonitorSmartphone, Search, ShieldAlert } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { PlatformAccessEditor } from "../components/platform-access-editor";
import { AccountApiQuotaEditor } from "../components/account-api-quota-editor";
import { TokenApiQuotaManager } from "../components/token-api-quota-manager";
import { useConsoleWorkspace } from "../components/console-workspace";

type PlatformUser = GetApiPlatformUsersStatus200["items"][number];
type EmailVerificationFilter = "all" | "verified" | "unverified";
const InspectorTabs = ["overview", "access", "apiQuota", "sessions", "activity"] as const;
type InspectorTab = (typeof InspectorTabs)[number];
const AccountStateReasons = Object.values(PutApiPlatformUsersByUserIdAccountStateRequestReasonEnum);

function isInspectorTab(value: string): value is InspectorTab {
	return InspectorTabs.some((tab) => tab === value);
}

function accountStateBadge(state: PlatformUser["accountState"]["state"]) {
	if (state === "active") return "success" as const;
	if (state === "suspended") return "warning" as const;
	return "destructive" as const;
}

function buildStateCommand(input: {
	readonly expectedRevision: number;
	readonly state: PlatformUserState;
	readonly reason: AccountStateReason;
	readonly note: string;
	readonly expiresAt: string;
}): PutApiPlatformUsersByUserIdAccountStateBody {
	if (input.state === "active")
		return { expectedRevision: input.expectedRevision, state: "active" };
	const note = input.note.trim() || undefined;
	if (input.state === "closed")
		return {
			expectedRevision: input.expectedRevision,
			state: "closed",
			reason: input.reason,
			...(note ? { note } : {}),
		};
	return {
		expectedRevision: input.expectedRevision,
		state: "suspended",
		reason: input.reason,
		...(note ? { note } : {}),
		...(input.expiresAt ? { expiresAt: new Date(input.expiresAt).toISOString() } : {}),
	};
}

export function ConsoleUsersPage({ selectedUserId }: { readonly selectedUserId: string | null }) {
	const { t } = useTranslation(["console"]);
	const { canReadUsers } = useConsoleWorkspace();
	const [search, setSearch] = useState("");
	const deferredSearch = useDeferredValue(search.trim());
	const [state, setState] = useState<PlatformUserState | "all">("all");
	const [verification, setVerification] = useState<EmailVerificationFilter>("all");
	const baseQuery = useMemo(
		() => ({
			limit: 50,
			...(deferredSearch ? { search: deferredSearch } : {}),
			...(state === "all" ? {} : { state }),
			...(verification === "all" ? {} : { emailVerified: verification === "verified" }),
		}),
		[deferredSearch, state, verification],
	);
	const users = useInfiniteQuery({
		queryKey: getApiPlatformUsersQueryKey({ query: baseQuery }),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await getApiPlatformUsers({
				query: { ...baseQuery, ...(pageParam ? { cursor: pageParam } : {}) },
				signal,
				throwOnError: true,
			});
			return data;
		},
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
		enabled: canReadUsers,
	});
	const items = users.data?.pages.flatMap((page) => page.items) ?? [];
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
			users.hasNextPage &&
			!users.isFetchingNextPage
		)
			void users.fetchNextPage();
	}, [
		items.length,
		lastVirtualIndex,
		users.fetchNextPage,
		users.hasNextPage,
		users.isFetchingNextPage,
	]);

	if (users.isPending) return <QueryPending />;
	if (users.isError) return <QueryFailure error={users.error} retry={() => void users.refetch()} />;

	return (
		<section className="flex h-full min-h-0 flex-col">
			<header className="border-border/70 border-b px-4 py-4 md:px-6">
				<h1 className="font-semibold text-xl tracking-tight">{t.console.sections.users.label}</h1>
				<p className="mt-1 text-muted-foreground text-sm">{t.console.sections.users.description}</p>
			</header>
			<div className="grid min-h-0 flex-1 lg:grid-cols-[23rem_minmax(0,1fr)]">
				<div
					className={cn(
						"flex min-h-0 flex-col border-border/70 lg:border-e",
						selectedUserId ? "hidden lg:flex" : "flex",
					)}
				>
					<div className="grid gap-3 border-border/70 border-b p-3">
						<label className="relative">
							<Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								aria-label={t.console.users.searchLabel}
								className="ps-9"
								onChange={(event) => setSearch(event.currentTarget.value)}
								placeholder={t.console.users.searchPlaceholder}
								value={search}
							/>
						</label>
						<div className="grid grid-cols-2 gap-2">
							<NativeSelect
								aria-label={t.console.users.stateFilter}
								onChange={(event) => {
									const value = event.currentTarget.value;
									setState(value === "all" ? "all" : (value as PlatformUserState));
								}}
								value={state}
							>
								<NativeSelectOption value="all">{t.console.users.allStates}</NativeSelectOption>
								{Object.values(GetApiPlatformUsersState).map((value) => (
									<NativeSelectOption key={value} value={value}>
										{t.console.users.states[value]}
									</NativeSelectOption>
								))}
							</NativeSelect>
							<NativeSelect
								aria-label={t.console.users.verificationFilter}
								onChange={(event) =>
									setVerification(event.currentTarget.value as EmailVerificationFilter)
								}
								value={verification}
							>
								<NativeSelectOption value="all">
									{t.console.users.allVerificationStates}
								</NativeSelectOption>
								<NativeSelectOption value="verified">{t.console.users.verified}</NativeSelectOption>
								<NativeSelectOption value="unverified">
									{t.console.users.unverified}
								</NativeSelectOption>
							</NativeSelect>
						</div>
					</div>
					<div className="min-h-0 flex-1 overflow-auto" ref={scrollRef}>
						{items.length === 0 ? (
							<p className="p-6 text-center text-muted-foreground text-sm">
								{t.console.users.empty}
							</p>
						) : (
							<div
								aria-label={t.console.sections.users.label}
								className="relative w-full"
								role="list"
								style={{ height: `${virtualizer.getTotalSize()}px` }}
							>
								{virtualItems.map((virtualItem) => {
									const user = items[virtualItem.index];
									if (!user) return null;
									const selected = user.userId === selectedUserId;
									return (
										<div
											aria-posinset={virtualItem.index + 1}
											aria-setsize={users.hasNextPage ? -1 : items.length}
											className="absolute start-0 top-0 w-full px-2 py-1"
											key={user.userId}
											role="listitem"
											style={{
												height: `${virtualItem.size}px`,
												transform: `translateY(${virtualItem.start}px)`,
											}}
										>
											<Link
												aria-current={selected ? "page" : undefined}
												className={cn(
													"flex h-full items-center gap-3 rounded-lg px-3 transition-colors",
													selected ? "bg-primary/10" : "hover:bg-accent",
												)}
												href={`/console/users/${user.userId}`}
											>
												<div className="grid size-9 shrink-0 place-items-center rounded-full bg-muted font-medium text-sm">
													{user.name.slice(0, 1).toUpperCase()}
												</div>
												<div className="min-w-0 flex-1">
													<p className="truncate font-medium text-sm">{user.name}</p>
													<p className="truncate text-muted-foreground text-xs">{user.email}</p>
												</div>
												<Badge pill size="sm" variant={accountStateBadge(user.accountState.state)}>
													{t.console.users.states[user.accountState.state]}
												</Badge>
											</Link>
										</div>
									);
								})}
							</div>
						)}
						{users.isFetchingNextPage ? (
							<p className="p-3 text-center text-muted-foreground text-xs">
								{t.console.users.loadingMore}
							</p>
						) : null}
					</div>
				</div>
				<div
					className={cn("min-h-0 overflow-y-auto", selectedUserId ? "block" : "hidden lg:block")}
				>
					{selectedUserId ? (
						<UserInspector key={selectedUserId} userId={selectedUserId} />
					) : (
						<div className="grid min-h-full place-items-center p-8 text-center">
							<div className="max-w-sm">
								<ShieldAlert className="mx-auto size-8 text-muted-foreground" />
								<p className="mt-3 font-medium">{t.console.users.selectUser}</p>
								<p className="mt-1 text-muted-foreground text-sm">
									{t.console.users.selectUserDescription}
								</p>
							</div>
						</div>
					)}
				</div>
			</div>
		</section>
	);
}

function UserInspector({ userId }: { readonly userId: string }) {
	const { locale, t } = useTranslation(["console", "errors"]);
	const [tab, setTab] = useState<InspectorTab>("overview");
	const { canReadAccess, canReadSessions, canReadAccountApiQuotas, canReadTokenApiQuotas } =
		useConsoleWorkspace();
	const user = useGetApiPlatformUsersByUserId({ path: { userId } });

	if (user.isPending) return <QueryPending />;
	if (user.isError || !user.data)
		return <QueryFailure error={user.error} retry={() => void user.refetch()} />;
	const formatter = new Intl.DateTimeFormat(locale.current, {
		dateStyle: "medium",
		timeStyle: "short",
	});

	return (
		<div className="min-h-full">
			<header className="sticky top-0 z-10 border-border/70 border-b bg-background/95 px-4 py-4 backdrop-blur md:px-6">
				<Link
					className="mb-3 inline-flex items-center gap-2 text-muted-foreground text-sm lg:hidden"
					href="/console/users"
				>
					<ArrowLeft className="size-4" />
					{t.console.users.backToUsers}
				</Link>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h2 className="font-semibold text-xl">{user.data.name}</h2>
						<p className="text-muted-foreground text-sm">{user.data.email}</p>
					</div>
					<Badge pill variant={accountStateBadge(user.data.accountState.state)}>
						{t.console.users.states[user.data.accountState.state]}
					</Badge>
				</div>
				<Tabs
					className="mt-4"
					onValueChange={({ value }) => {
						if (isInspectorTab(value)) setTab(value);
					}}
					value={tab}
				>
					<TabsList className="max-w-full overflow-x-auto" variant="underline">
						<TabsTrigger value="overview">{t.console.users.tabs.overview}</TabsTrigger>
						<TabsTrigger disabled={!canReadAccess} value="access">
							{t.console.users.tabs.access}
						</TabsTrigger>
						<TabsTrigger
							disabled={!canReadAccountApiQuotas && !canReadTokenApiQuotas}
							value="apiQuota"
						>
							{t.console.users.tabs.apiQuota}
						</TabsTrigger>
						<TabsTrigger disabled={!canReadSessions} value="sessions">
							{t.console.users.tabs.sessions}
						</TabsTrigger>
						<TabsTrigger value="activity">{t.console.users.tabs.activity}</TabsTrigger>
					</TabsList>
				</Tabs>
			</header>
			<div className="p-4 md:p-6">
				<Tabs value={tab}>
					<TabsContent value="overview">
						<UserOverview formatter={formatter} user={user.data} userId={userId} />
					</TabsContent>
					<TabsContent value="access">
						<UserPlatformAccess profileId={user.data.profileId} userId={userId} />
					</TabsContent>
					<TabsContent value="apiQuota">
						<div className="grid gap-6">
							{canReadAccountApiQuotas ? <AccountApiQuotaEditor userId={userId} /> : null}
							<TokenApiQuotaManager userId={userId} />
						</div>
					</TabsContent>
					<TabsContent value="sessions">
						<UserSessions userId={userId} />
					</TabsContent>
					<TabsContent value="activity">
						<UserActivity formatter={formatter} userId={userId} />
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}

function UserOverview({
	formatter,
	user,
	userId,
}: {
	readonly formatter: Intl.DateTimeFormat;
	readonly user: PlatformUser;
	readonly userId: string;
}) {
	const { t } = useTranslation(["console"]);
	const { canManageUserStatus } = useConsoleWorkspace();
	const queryClient = useQueryClient();
	const [state, setState] = useState<PlatformUserState>(user.accountState.state);
	const [reason, setReason] = useState<AccountStateReason>(user.accountState.reason ?? "security");
	const [note, setNote] = useState(user.accountState.note ?? "");
	const [expiresAt, setExpiresAt] = useState("");
	const mutation = usePutApiPlatformUsersByUserIdAccountState({
		mutation: {
			onSuccess: async () => {
				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: getApiPlatformUsersQueryKey(),
					}),
					queryClient.invalidateQueries({
						queryKey: getApiPlatformUsersByUserIdQueryKey({
							path: { userId },
						}),
					}),
					queryClient.invalidateQueries({
						queryKey: getApiPlatformUsersByUserIdSessionsQueryKey({
							path: { userId },
						}),
					}),
				]);
			},
		},
	});
	useEffect(() => {
		setState(user.accountState.state);
		setReason(user.accountState.reason ?? "security");
		setNote(user.accountState.note ?? "");
		setExpiresAt("");
	}, [
		user.accountState.note,
		user.accountState.reason,
		user.accountState.revision,
		user.accountState.state,
	]);

	const submit = (event: FormEvent) => {
		event.preventDefault();
		mutation.mutate({
			path: { userId },
			body: buildStateCommand({
				expectedRevision: Number(user.accountState.revision),
				state,
				reason,
				note,
				expiresAt,
			}),
		});
	};

	return (
		<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
			<Card appearance="outlined">
				<CardHeader>
					<CardTitle>{t.console.users.identityTitle}</CardTitle>
					<CardDescription>{t.console.users.identityDescription}</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4 text-sm sm:grid-cols-2">
					<div>
						<p className="text-muted-foreground">{t.console.users.email}</p>
						<p className="mt-1 break-all font-medium">{user.email}</p>
					</div>
					<div>
						<p className="text-muted-foreground">{t.console.users.verification}</p>
						<p className="mt-1 flex items-center gap-2 font-medium">
							{user.emailVerified ? <CheckCircle2 className="size-4 text-success" /> : null}
							{user.emailVerified ? t.console.users.verified : t.console.users.unverified}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground">{t.console.users.userId}</p>
						<code className="mt-1 block break-all text-xs">{user.userId}</code>
					</div>
					<div>
						<p className="text-muted-foreground">{t.console.users.profileId}</p>
						<code className="mt-1 block break-all text-xs">
							{user.profileId ?? t.console.users.noProfile}
						</code>
					</div>
					<div>
						<p className="text-muted-foreground">{t.console.users.createdAt}</p>
						<p className="mt-1 font-medium">{formatter.format(new Date(user.createdAt))}</p>
					</div>
					<div>
						<p className="text-muted-foreground">{t.console.users.activeSessions}</p>
						<p className="mt-1 font-medium">{Number(user.activeSessionCount)}</p>
					</div>
				</CardContent>
			</Card>
			<Card appearance="outlined">
				<CardHeader>
					<CardTitle>{t.console.users.accountStateTitle}</CardTitle>
					<CardDescription>{t.console.users.accountStateDescription}</CardDescription>
				</CardHeader>
				<CardContent>
					{canManageUserStatus ? (
						<form className="grid gap-4" onSubmit={submit}>
							<Field>
								<FieldLabel>{t.console.users.accountState}</FieldLabel>
								<NativeSelect
									onChange={(event) => setState(event.currentTarget.value as PlatformUserState)}
									value={state}
								>
									{Object.values(GetApiPlatformUsersState).map((value) => (
										<NativeSelectOption key={value} value={value}>
											{t.console.users.states[value]}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</Field>
							{state !== "active" ? (
								<>
									<Field>
										<FieldLabel>{t.console.users.reason}</FieldLabel>
										<NativeSelect
											onChange={(event) =>
												setReason(event.currentTarget.value as AccountStateReason)
											}
											value={reason}
										>
											{AccountStateReasons.map((value) => (
												<NativeSelectOption key={value} value={value}>
													{t.console.users.reasons[value]}
												</NativeSelectOption>
											))}
										</NativeSelect>
									</Field>
									{state === "suspended" ? (
										<Field>
											<FieldLabel>{t.console.users.suspensionExpiry}</FieldLabel>
											<Input
												min={new Date().toISOString().slice(0, 16)}
												onChange={(event) => setExpiresAt(event.currentTarget.value)}
												type="datetime-local"
												value={expiresAt}
											/>
										</Field>
									) : null}
									<Field>
										<FieldLabel>{t.console.users.internalNote}</FieldLabel>
										<Textarea
											maxLength={2_000}
											onChange={(event) => setNote(event.currentTarget.value)}
											placeholder={t.console.users.notePlaceholder}
											value={note}
										/>
									</Field>
								</>
							) : null}
							<RequestFailure error={mutation.error} fallback={t.console.users.updateFailed} />
							<Button
								isLoading={mutation.isPending}
								type="submit"
								variant={state === "closed" ? "destructive" : "solid"}
							>
								{t.console.users.saveAccountState}
							</Button>
						</form>
					) : (
						<p className="text-muted-foreground text-sm">{t.console.users.accountStateReadOnly}</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

function UserPlatformAccess({
	profileId,
	userId,
}: {
	readonly profileId: string | null;
	readonly userId: string;
}) {
	const { t } = useTranslation(["console"]);
	const { canReadAccess, canManageAccess } = useConsoleWorkspace();
	const queryClient = useQueryClient();
	const policy = useGetApiPlatformAccessPolicy({
		query: { enabled: canReadAccess && Boolean(profileId) },
	});
	const access = useGetApiPlatformAccessProfilesByProfileId(
		{ path: { profileId: profileId ?? userId } },
		{ query: { enabled: canReadAccess && Boolean(profileId) } },
	);
	if (!profileId)
		return (
			<p className="rounded-lg border border-border p-4 text-muted-foreground text-sm">
				{t.console.users.platformAccessUnavailable}
			</p>
		);
	if (policy.isPending || access.isPending) return <QueryPending />;
	if (policy.isError || !policy.data)
		return <QueryFailure error={policy.error} retry={() => void policy.refetch()} />;
	if (access.isError || !access.data)
		return <QueryFailure error={access.error} retry={() => void access.refetch()} />;
	return (
		<PlatformAccessEditor
			canManage={canManageAccess}
			capabilities={policy.data.capabilities}
			key={`${access.data.profileId}:${access.data.revision}`}
			onSaved={async () => {
				await queryClient.invalidateQueries({
					queryKey: getApiPlatformAccessProfilesByProfileIdQueryKey({
						path: { profileId },
					}),
				});
			}}
			profile={access.data}
		/>
	);
}

function UserSessions({ userId }: { readonly userId: string }) {
	const { locale, t } = useTranslation(["console"]);
	const { canReadSessions, canRevokeSessions } = useConsoleWorkspace();
	const queryClient = useQueryClient();
	const sessions = useGetApiPlatformUsersByUserIdSessions(
		{ path: { userId } },
		{ query: { enabled: canReadSessions } },
	);
	const refresh = () =>
		Promise.all([
			queryClient.invalidateQueries({
				queryKey: getApiPlatformUsersByUserIdSessionsQueryKey({
					path: { userId },
				}),
			}),
			queryClient.invalidateQueries({ queryKey: getApiPlatformUsersQueryKey() }),
		]);
	const revokeAll = useDeleteApiPlatformUsersByUserIdSessions({
		mutation: { onSuccess: refresh },
	});
	const revokeOne = useDeleteApiPlatformUsersByUserIdSessionsBySessionId({
		mutation: { onSuccess: refresh },
	});
	if (sessions.isPending) return <QueryPending />;
	if (sessions.isError || !sessions.data)
		return <QueryFailure error={sessions.error} retry={() => void sessions.refetch()} />;
	const formatter = new Intl.DateTimeFormat(locale.current, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	return (
		<Card appearance="outlined">
			<CardHeader className="flex-row items-start justify-between gap-3">
				<div>
					<CardTitle>{t.console.users.sessionsTitle}</CardTitle>
					<CardDescription>{t.console.users.sessionsDescription}</CardDescription>
				</div>
				{canRevokeSessions && sessions.data.items.length > 0 ? (
					<Button
						isLoading={revokeAll.isPending}
						onClick={() => revokeAll.mutate({ path: { userId } })}
						size="sm"
						variant="destructive"
					>
						{t.console.users.revokeAllSessions}
					</Button>
				) : null}
			</CardHeader>
			<CardContent className="grid gap-2">
				{sessions.data.items.length === 0 ? (
					<p className="py-6 text-center text-muted-foreground text-sm">
						{t.console.users.noSessions}
					</p>
				) : (
					sessions.data.items.map((session) => (
						<div
							className="flex flex-wrap items-start gap-3 rounded-lg border border-border p-3"
							key={session.id}
						>
							<MonitorSmartphone className="mt-1 size-5 text-muted-foreground" />
							<div className="min-w-0 flex-1">
								<div className="flex flex-wrap items-center gap-2">
									<p className="font-medium text-sm">
										{session.userAgent ?? t.console.users.unknownDevice}
									</p>
									{session.current ? (
										<Badge variant="info">{t.console.users.currentSession}</Badge>
									) : null}
								</div>
								<p className="mt-1 text-muted-foreground text-xs">
									{session.ipAddress ?? t.console.users.unknownIp}
								</p>
								<p className="mt-1 text-muted-foreground text-xs">
									{t.console.users.sessionExpiry({
										date: formatter.format(new Date(session.expiresAt)),
									})}
								</p>
							</div>
							{canRevokeSessions ? (
								<Button
									disabled={revokeOne.isPending}
									onClick={() =>
										revokeOne.mutate({
											path: { userId, sessionId: session.id },
										})
									}
									size="sm"
									variant="outline"
								>
									{t.console.users.revokeSession}
								</Button>
							) : null}
						</div>
					))
				)}
				<RequestFailure
					error={revokeAll.error ?? revokeOne.error}
					fallback={t.console.users.sessionRevokeFailed}
				/>
			</CardContent>
		</Card>
	);
}

function UserActivity({
	formatter,
	userId,
}: {
	readonly formatter: Intl.DateTimeFormat;
	readonly userId: string;
}) {
	const { t } = useTranslation(["console"]);
	const { canReadAudit } = useConsoleWorkspace();
	const activity = useGetApiAuditEvents(
		{ query: { targetId: userId, limit: 50 } },
		{ query: { enabled: canReadAudit } },
	);
	if (!canReadAudit)
		return <p className="text-muted-foreground text-sm">{t.console.users.activityUnavailable}</p>;
	if (activity.isPending) return <QueryPending />;
	if (activity.isError || !activity.data)
		return <QueryFailure error={activity.error} retry={() => void activity.refetch()} />;
	return (
		<Card appearance="outlined">
			<CardHeader>
				<CardTitle>{t.console.users.activityTitle}</CardTitle>
				<CardDescription>{t.console.users.activityDescription}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-2">
				{activity.data.items.length === 0 ? (
					<p className="py-6 text-center text-muted-foreground text-sm">
						{t.console.users.noActivity}
					</p>
				) : (
					activity.data.items.map((event) => (
						<div
							className="grid gap-1 rounded-lg border border-border p-3 sm:grid-cols-[10rem_1fr_auto]"
							key={event.id}
						>
							<time className="text-muted-foreground text-xs">
								{formatter.format(new Date(event.createdAt))}
							</time>
							<code className="break-all text-xs">{event.action}</code>
							<Badge
								variant={
									event.outcome === "succeeded"
										? "success"
										: event.outcome === "denied"
											? "warning"
											: "destructive"
								}
							>
								{t.console.audit.outcomes[event.outcome]}
							</Badge>
						</div>
					))
				)}
			</CardContent>
		</Card>
	);
}
