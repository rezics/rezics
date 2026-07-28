"use client";

import { toContentLanguage } from "@rezics/i18n";

import {
	useDeleteApiRealmsByRealmIdMembership,
	useGetApiRealms,
	useGetApiRealmsByRealmId,
	useGetApiRealmsByRealmIdPins,
	useGetApiRealmsByRealmIdRules,
	usePostApiRealms,
	usePutApiRealmsByRealmIdMembership,
	type GetApiRealmsByRealmIdPinsStatus200,
	type GetApiRealmsByRealmIdStatus200,
	type GetApiRealmsStatus200,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";

import { Banner, PageHeading } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Badge } from "@rezics/ui";
import { Card, CardContent } from "@rezics/ui";
import { IdentityAvatar } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { NativeSelect, NativeSelectOption } from "@rezics/ui";
import { Skeleton } from "@rezics/ui";
import { Textarea } from "@rezics/ui";
import { UsersIcon } from "lucide-react";
import { SignInButton } from "@/features/auth/auth-portal";
import { RequireSession } from "@/features/auth/require-session";
import { UnitDockRenderer, useDockManagementAccess } from "@/features/docks";
import { FollowButton } from "@/features/following/components/follow-button";
import { realmHref, realmSettingsHref } from "@/features/slugs/unit-route";
import {
	LocalizationImageUploadField,
	type LocalizationImageAssetValue,
} from "@/features/media/components/localization-image-upload-field";
import {
	AvatarField,
	type AvatarFieldValue,
	avatarPresentationToInput,
} from "@/features/media/components/avatar-field";
import { postHref } from "@/features/posts/url";
import { tagDetailHref } from "@/features/tags/routing/tag-links";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { selectLocalization } from "@/lib/localization";
import { toNonNegativeApiInteger } from "@/lib/api-number";
import { useTranslation } from "@/i18n/client";
import { useLocalizationFallbackToast } from "@/i18n/use-localization-fallback-toast";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { useHeaderSearchOverride } from "@/features/application-shell/header-search";
import { RequestFailure } from "@/i18n/request-failure";
import { publicUnitHref } from "@/features/units/routing/public-unit-route";
import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";
import { canOpenRealmSettings, isRealmOwner } from "./realm-permissions";
import { invalidateRealmDetails } from "./query";
import { RealmFeed } from "./components/realm-feed";
import { RealmPinnedContentSection } from "./components/realm-pinned-content-section";
import { RealmRulesCard, type RealmRulePresentation } from "./components/realm-rules-card";
import { RealmRulesAcknowledgementPrompt } from "./components/realm-rules-acknowledgement-prompt";
import { useRealmRulesAcknowledgement } from "./hooks/use-realm-rules-acknowledgement";

export function RealmsPage() {
	const { t } = useTranslation(["actions", "media", "posts", "realms", "state", "ui"]);
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiRealms({
		query: { localizationLanguages, limit: 20 },
	});
	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				title={t.realms.title}
				action={
					<Button variant="solid" asChild>
						<Link href="/realms/new">{t.realms.create}</Link>
					</Button>
				}
			/>
			{query.isPending ? (
				<div className="grid gap-3">
					{Array.from({ length: 4 }, (_, index) => (
						<Skeleton key={index} className="h-28 rounded-xl" />
					))}
				</div>
			) : query.isError ? (
				<div className="flex flex-col items-start gap-3">
					<RequestFailure error={query.error} />
					<Button variant="outline" size="sm" onClick={() => void query.refetch()}>
						{t.actions.retry}
					</Button>
				</div>
			) : query.data?.items.length ? (
				<div className="grid gap-3">
					{query.data.items.map((realm) => (
						<RealmListCard key={realm.id} realm={realm} />
					))}
				</div>
			) : (
				<p className="text-muted-foreground text-sm">{t.state.empty}</p>
			)}
		</main>
	);
}

function RealmListCard({ realm }: { readonly realm: GetApiRealmsStatus200["items"][number] }) {
	const { t } = useTranslation(["realms"]);
	const title = useChineseContentText(
		realm.title ?? t.realms.untitled,
		realm.title ? realm.language : null,
	);
	const summary = useChineseContentText(realm.summary ?? "", realm.language);

	return (
		<Link href={realmHref(realm)}>
			<Card className="transition-colors hover:bg-surface-hover">
				<CardContent className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 p-5">
					<IdentityAvatar
						avatar={realm.avatar}
						className="size-12"
						fallback={title.slice(0, 1).toUpperCase()}
					/>
					<div className="grid min-w-0 gap-2">
						<h2 className="font-semibold">{title}</h2>
						{summary ? (
							<p className="text-muted-foreground line-clamp-2 text-sm">{summary}</p>
						) : null}
						<p className="text-muted-foreground text-sm">
							{t.realms.joinPolicy}:{" "}
							{realm.joinPolicy === "approval" ? t.realms.approval : t.realms.open}
						</p>
					</div>
				</CardContent>
			</Card>
		</Link>
	);
}

function RealmCreateContent() {
	const { t, locale } = useTranslation(["actions", "media", "posts", "realms", "state", "ui"]);
	const router = useRouter();
	const queryClient = useQueryClient();
	const [avatar, setAvatar] = useState<AvatarFieldValue | null>(null);
	const [banner, setBanner] = useState<LocalizationImageAssetValue | null>(null);
	const create = usePostApiRealms();

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const title = String(data.get("title") ?? "").trim();
		const summary = String(data.get("summary") ?? "").trim();
		if (!title) return;
		create.mutate(
			{
				body: {
					localization: {
						language: toContentLanguage(locale.target),
						title,
						avatar: avatarPresentationToInput(avatar),
						bannerAssetId: banner?.id ?? null,
						...(summary ? { summary } : {}),
					},
					visibility: "public",
					joinPolicy: data.get("joinPolicy") === "approval" ? "approval" : "open",
				},
			},
			{
				onSuccess: async (realm) => {
					await invalidateRealmDetails(queryClient, realm.id);
					router.push(realmHref(realm));
				},
			},
		);
	}

	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
				<PageHeading title={t.realms.createTitle} />
				<form onSubmit={submit}>
					<FieldGroup>
						<Field required>
							<FieldLabel>{t.ui.title}</FieldLabel>
							<Input name="title" required maxLength={500} />
						</Field>
						<Field>
							<FieldLabel>{t.ui.summary}</FieldLabel>
							<Textarea name="summary" maxLength={2000} />
						</Field>
						<Field>
							<FieldLabel>{t.media.roles.avatar.title}</FieldLabel>
							<AvatarField onChange={setAvatar} value={avatar} />
						</Field>
						<Field>
							<FieldLabel>{t.media.roles.banner.title}</FieldLabel>
							<LocalizationImageUploadField
								onChange={setBanner}
								role="banner"
								value={banner}
							/>
						</Field>
						<Field>
							<FieldLabel>{t.realms.joinPolicy}</FieldLabel>
							<NativeSelect name="joinPolicy" defaultValue="open">
								<NativeSelectOption value="open">
									{t.realms.open}
								</NativeSelectOption>
								<NativeSelectOption value="approval">
									{t.realms.approval}
								</NativeSelectOption>
							</NativeSelect>
						</Field>
						<RequestFailure error={create.error} />
						<Button
							variant="solid"
							type="submit"
							className="w-fit"
							isLoading={create.isPending}
						>
							{t.realms.create}
						</Button>
					</FieldGroup>
				</form>
			</main>
		</RequireSession>
	);
}

export function RealmCreatePage() {
	return <RealmCreateContent />;
}

export function RealmDetailPage({ id }: { id: string }) {
	const { t, locale } = useTranslation([
		"actions",
		"media",
		"posts",
		"realms",
		"search",
		"state",
		"ui",
	]);
	const localizationLanguages = useLocalizationLanguages();
	const { data: session } = useHydratedSession();
	const dockAccess = useDockManagementAccess(id, "realm", Boolean(session));
	const query = useGetApiRealmsByRealmId({
		path: { realmId: id },
		query: { localizationLanguages },
	});
	useLocalizationFallbackToast({
		actualLanguage: query.data?.language ?? null,
		localizationLanguages,
		unitId: id,
	});
	const localization = query.data
		? selectLocalization(query.data.localizations, query.data.language ?? "")
		: null;
	const displayedTitle = useChineseContentText(
		localization?.title ?? t.realms.untitled,
		localization?.title ? localization.language : null,
	);
	const displayedSummary = useChineseContentText(
		localization?.summary ?? "",
		localization?.language,
	);
	const headerSearch = useMemo(() => {
		if (!query.data) return undefined;
		return {
			href: `${realmHref(query.data)}/search`,
			label: t.search.withinLabel({ name: displayedTitle }),
			placeholder: t.search.withinPlaceholder({ name: displayedTitle }),
			avatar: query.data.avatar,
			avatarFallback: displayedTitle.slice(0, 1).toUpperCase(),
		};
	}, [displayedTitle, locale.target, query.data, t.search]);
	useHeaderSearchOverride(headerSearch);
	const rules = useGetApiRealmsByRealmIdRules(
		{ path: { realmId: id }, query: { localizationLanguages } },
		{
			query: { enabled: Boolean(query.data) },
		},
	);
	const pins = useGetApiRealmsByRealmIdPins(
		{ path: { realmId: id } },
		{
			query: { enabled: Boolean(query.data) },
		},
	);
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data) return <QueryPending />;
	const realm = query.data;
	const canManage = canOpenRealmSettings(realm.capabilities, dockAccess.allowedKinds.length > 0);
	const canPost = realm.capabilities.canCreateUnits;
	return (
		<main className="mx-auto flex w-full max-w-[76rem] flex-col gap-7 px-4 py-6 sm:px-6 sm:py-9">
			<header className="grid gap-6 border-b pb-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
				{realm.banner ? (
					<Banner
						alt=""
						className="col-span-full rounded-2xl bg-muted"
						priority
						src={realm.banner.url}
					/>
				) : null}
				<div className="min-w-0">
					<div className="mb-4 flex items-center gap-4">
						<IdentityAvatar
							avatar={realm.avatar}
							className="size-16 ring-4 ring-background sm:size-20"
							fallback={displayedTitle.slice(0, 1).toUpperCase()}
						/>
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant="secondary">{t.ui.realm}</Badge>
							<Badge variant="outline">
								{realm.joinPolicy === "approval"
									? t.realms.approval
									: t.realms.open}
							</Badge>
							{realm.viewerMembership?.state === "pending" ? (
								<Badge variant="outline">{t.realms.membershipPending}</Badge>
							) : null}
						</div>
					</div>
					<h1 className="break-words font-serif font-semibold text-3xl tracking-tight sm:text-5xl">
						{displayedTitle}
					</h1>
					{realm.slugAddress ? (
						<p className="mt-1 font-mono text-muted-foreground text-sm">
							/{realm.slugAddress.slug}
						</p>
					) : null}
					{localization?.summary ? (
						<p className="mt-3 max-w-3xl text-base text-muted-foreground leading-7 sm:text-lg">
							{displayedSummary}
						</p>
					) : null}
				</div>
				<RealmActions canManage={canManage} canPost={canPost} realm={realm} />
			</header>

			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
				<div className="grid min-w-0 gap-5">
					<RealmPinnedContentSection
						emptyLabel={t.realms.pinnedContentEmpty}
						nextLabel={t.realms.pinnedCarouselNext}
						previousLabel={t.realms.pinnedCarouselPrevious}
						state={
							pins.isError
								? {
										status: "error",
										feedback: <RequestFailure error={pins.error} />,
									}
								: pins.data
									? {
											status: "ready",
											items: pins.data.contentItems.map((item) => ({
												id: item.id,
												body:
													item.itemType === "post"
														? item.body
														: undefined,
												href: realmPinnedContentHref(item, realm.id),
												imageUrl: item.cover?.url,
												language: item.language,
												summary: item.summary,
												title: item.title,
											})),
										}
									: { status: "loading" }
						}
						title={t.realms.pins}
						untitledLabel={t.ui.unnamed}
					/>

					<RealmFeed realmId={realm.id} />
				</div>

				<aside className="grid min-w-0 max-w-full gap-5 overflow-hidden lg:sticky lg:top-20">
					<RealmSidebarRulesSection
						error={rules.error}
						isError={rules.isError}
						rules={rules.data?.items}
						title={t.realms.rules}
					/>
					<RealmSidebarMembersSection
						label={t.realms.members}
						valueLabel={t.realms.memberCount({
							count: toNonNegativeApiInteger(realm.memberCount),
						})}
					/>
					<UnitDockRenderer
						ownerUnitId={realm.id}
						target={{ ownerKind: "realm", dockKind: "main" }}
					/>
				</aside>
			</div>
		</main>
	);
}

/**
 * Keeps Realm rules in the mandatory sidebar sequence while they remain owner-rendered.
 *
 * @remarks
 * This system section must move behind the main Dock renderer once Dock supports protected,
 * non-removable Realm sections.
 */
function RealmSidebarRulesSection({
	error,
	isError,
	rules,
	title,
}: {
	readonly error: unknown;
	readonly isError: boolean;
	readonly rules?: readonly RealmRulePresentation[];
	readonly title: string;
}) {
	if (isError) return <RequestFailure error={error} />;
	return rules?.length ? <RealmRulesCard rules={rules} title={title} /> : null;
}

/**
 * Keeps the Realm member summary in the mandatory sidebar sequence while it is owner-rendered.
 *
 * @remarks
 * This system section must move behind the main Dock renderer once Dock supports protected,
 * non-removable Realm sections.
 */
function RealmSidebarMembersSection({
	label,
	valueLabel,
}: {
	readonly label: string;
	readonly valueLabel: string;
}) {
	return (
		<Card appearance="outlined">
			<CardContent className="flex items-center justify-between gap-4 px-5">
				<div className="grid gap-1">
					<h2 className="font-serif font-semibold text-lg">{label}</h2>
					<p className="text-muted-foreground text-sm">{valueLabel}</p>
				</div>
				<UsersIcon aria-hidden className="size-5 text-brand" />
			</CardContent>
		</Card>
	);
}

function realmPinnedContentHref(
	item: GetApiRealmsByRealmIdPinsStatus200["contentItems"][number],
	realmId: string,
): string | undefined {
	if (item.itemType === "post") {
		if (item.postKind === "post" || item.postKind === "reply") {
			return postHref(item.id, { kind: "realm", realmId });
		}
		if (item.postKind === "review") return postHref(item.id, { kind: "realm", realmId });
		return undefined;
	}
	if (item.unitKind === "tag") return tagDetailHref(item.id);
	return publicUnitHref(item.unitKind, item);
}

function RealmActions({
	realm,
	canManage,
	canPost,
}: {
	realm: GetApiRealmsByRealmIdStatus200;
	canManage: boolean;
	canPost: boolean;
}) {
	const { t } = useTranslation(["actions", "media", "posts", "realms", "state", "ui"]);
	const queryClient = useQueryClient();
	const { data: session } = useHydratedSession();
	const join = usePutApiRealmsByRealmIdMembership();
	const leave = useDeleteApiRealmsByRealmIdMembership();
	const rulesAcknowledgement = useRealmRulesAcknowledgement(realm.id);
	const membership = realm.viewerMembership;

	async function joinRealm() {
		await join.mutateAsync({ path: { realmId: realm.id } });
		await invalidateRealmDetails(queryClient, realm.id);
	}

	if (!session)
		return <SignInButton destination={realmHref(realm)}>{t.realms.signInToJoin}</SignInButton>;

	return (
		<>
			<div className="flex flex-col items-end gap-2">
				<div className="flex flex-wrap justify-end gap-2">
					<FollowButton
						initialFollowing={realm.viewerFollowing}
						onChanged={() => invalidateRealmDetails(queryClient, realm.id)}
						unitId={realm.id}
					/>
					{!isRealmOwner(membership) && (
						<Button
							variant="outline"
							isLoading={join.isPending || leave.isPending}
							onClick={() => {
								if (membership)
									leave.mutate(
										{ path: { realmId: realm.id } },
										{
											onSuccess: () =>
												invalidateRealmDetails(queryClient, realm.id),
										},
									);
								else
									void rulesAcknowledgement.run(joinRealm).catch(() => undefined);
							}}
						>
							{membership ? t.realms.leave : t.realms.join}
						</Button>
					)}
					{canPost ? (
						<Button variant="solid" asChild>
							<Link href={`/posts/new?realmId=${realm.id}`}>{t.posts.create}</Link>
						</Button>
					) : null}
					{canManage && (
						<Button variant="solid" asChild>
							<Link href={realmSettingsHref(realm)}>{t.realms.settings}</Link>
						</Button>
					)}
				</div>
				<RequestFailure error={join.error ?? leave.error} />
			</div>
			<RealmRulesAcknowledgementPrompt controller={rulesAcknowledgement} intent="join" />
		</>
	);
}
