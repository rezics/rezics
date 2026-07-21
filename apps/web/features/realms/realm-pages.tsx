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
	type GetApiRealmsByRealmIdStatus200,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { PinIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { PageHeading } from "@rezics/ui";
import { PortableTextContent } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Badge } from "@rezics/ui";
import { Card, CardContent } from "@rezics/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { NativeSelect, NativeSelectOption } from "@rezics/ui";
import { Skeleton } from "@rezics/ui";
import { Textarea } from "@rezics/ui";
import { SignInButton } from "@/features/auth/auth-portal";
import { RequireSession } from "@/features/auth/require-session";
import { FollowButton } from "@/features/following/components/follow-button";
import { realmHref, realmSettingsHref } from "@/features/slugs/unit-route";
import {
	LocalizationImageUploadField,
	type LocalizationImageAssetValue,
} from "@/features/units/localization-image-upload-field";
import { PostList } from "@/features/posts/post-list";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { selectLocalization } from "@/lib/localization";
import { useTranslation } from "@/i18n/client";
import { readPortableText } from "@/lib/block";
import { RequestFailure } from "@/i18n/request-failure";
import { canManageRealm, isRealmOwner } from "./realm-permissions";
import { invalidateRealmDetails } from "./query";

export function RealmsPage() {
	const { t, locale } = useTranslation([
		"actions",
		"feed",
		"media",
		"posts",
		"realms",
		"state",
		"ui",
	]);
	const query = useGetApiRealms({
		query: { language: toContentLanguage(locale.target), limit: 20 },
	});
	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				title={t.realms.title}
				action={
					<Button asChild>
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
						<Link key={realm.id} href={realmHref(realm)}>
							<Card className="transition-colors hover:bg-surface-hover">
								<CardContent className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 p-5">
									<Avatar className="size-12">
										{realm.avatar ? (
											<AvatarImage alt="" src={realm.avatar.url} />
										) : null}
										<AvatarFallback>
											{(realm.title ?? t.realms.untitled)
												.slice(0, 1)
												.toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<div className="grid min-w-0 gap-2">
										<h2 className="font-semibold">
											{realm.title ?? t.realms.untitled}
										</h2>
										{realm.summary && (
											<p className="text-muted-foreground line-clamp-2 text-sm">
												{realm.summary}
											</p>
										)}
										<p className="text-muted-foreground text-sm">
											{t.realms.joinPolicy}:{" "}
											{realm.joinPolicy === "approval"
												? t.realms.approval
												: t.realms.open}
										</p>
									</div>
								</CardContent>
							</Card>
						</Link>
					))}
				</div>
			) : (
				<p className="text-muted-foreground text-sm">{t.state.empty}</p>
			)}
		</main>
	);
}

export function RealmCreatePage() {
	const { t, locale } = useTranslation([
		"actions",
		"feed",
		"media",
		"posts",
		"realms",
		"state",
		"ui",
	]);
	const router = useRouter();
	const queryClient = useQueryClient();
	const [avatar, setAvatar] = useState<LocalizationImageAssetValue | null>(null);
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
						avatarAssetId: avatar?.id ?? null,
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
							<LocalizationImageUploadField
								onChange={setAvatar}
								role="avatar"
								shape="avatar"
								value={avatar}
							/>
						</Field>
						<Field>
							<FieldLabel>{t.media.roles.banner.title}</FieldLabel>
							<LocalizationImageUploadField
								onChange={setBanner}
								role="banner"
								shape="banner"
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
						<Button type="submit" className="w-fit" isLoading={create.isPending}>
							{t.realms.create}
						</Button>
					</FieldGroup>
				</form>
			</main>
		</RequireSession>
	);
}

export function RealmDetailPage({ id }: { id: string }) {
	const { t, locale } = useTranslation([
		"actions",
		"feed",
		"media",
		"posts",
		"realms",
		"state",
		"ui",
	]);
	const query = useGetApiRealmsByRealmId({
		path: { realmId: id },
		query: { language: toContentLanguage(locale.target) },
	});
	const rules = useGetApiRealmsByRealmIdRules(
		{ path: { realmId: id } },
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
	const localization = selectLocalization(
		realm.localizations,
		toContentLanguage(locale.target),
		realm.language,
	);
	const canManage = canManageRealm(realm.viewerMembership);
	const canPost = realm.viewerMembership?.state === "active";
	return (
		<main className="mx-auto flex w-full max-w-[76rem] flex-col gap-7 px-4 py-6 sm:px-6 sm:py-9">
			<header className="grid gap-6 border-b pb-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
				{realm.banner ? (
					<div className="col-span-full aspect-[3/1] overflow-hidden rounded-2xl bg-muted">
						<img alt="" className="size-full object-cover" src={realm.banner.url} />
					</div>
				) : null}
				<div className="min-w-0">
					<div className="mb-4 flex items-center gap-4">
						<Avatar className="size-16 ring-4 ring-background sm:size-20">
							{realm.avatar ? <AvatarImage alt="" src={realm.avatar.url} /> : null}
							<AvatarFallback>
								{(localization?.title ?? t.realms.untitled)
									.slice(0, 1)
									.toUpperCase()}
							</AvatarFallback>
						</Avatar>
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
						{localization?.title ?? t.realms.untitled}
					</h1>
					{realm.slugAddress ? (
						<p className="mt-1 font-mono text-muted-foreground text-sm">
							/{realm.slugAddress.slug}
						</p>
					) : null}
					{localization?.summary ? (
						<p className="mt-3 max-w-3xl text-base text-muted-foreground leading-7 sm:text-lg">
							{localization.summary}
						</p>
					) : null}
				</div>
				<RealmActions
					canManage={canManage}
					realm={realm}
					ruleRevisionId={rules.data?.revisionId ?? undefined}
				/>
			</header>

			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
				<Card className="min-w-0 gap-0 overflow-hidden py-0">
					<div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-5">
						<div>
							<h2 className="font-serif font-semibold text-2xl">{t.realms.feed}</h2>
							<p className="mt-1 text-muted-foreground text-sm">{t.feed.trending}</p>
						</div>
						{canPost ? (
							<Button asChild size="sm">
								<Link href={`/posts/new?realmId=${realm.id}`}>
									{t.posts.create}
								</Link>
							</Button>
						) : null}
					</div>
					<PostList realmId={realm.id} />
				</Card>

				<aside className="grid min-w-0 gap-5 lg:sticky lg:top-20">
					{rules.isError ? (
						<RequestFailure error={rules.error} />
					) : rules.data?.items.length ? (
						<Card className="min-w-0">
							<CardContent className="grid gap-4 px-5">
								<div className="flex items-center justify-between gap-3">
									<h2 className="font-serif font-semibold text-lg">
										{t.realms.rules}
									</h2>
									<ShieldCheckIcon aria-hidden className="size-4 text-brand" />
								</div>
								{rules.data.items.map((rule, index) => (
									<section
										className="grid gap-1.5 border-t pt-3 first:border-t-0 first:pt-0"
										key={rule.id}
									>
										<h3 className="font-medium text-sm">
											{index + 1}. {rule.title}
										</h3>
										<PortableTextContent
											value={readPortableText(rule.content)}
											variant="compact"
										/>
									</section>
								))}
							</CardContent>
						</Card>
					) : null}

					{pins.isError ? (
						<RequestFailure error={pins.error} />
					) : pins.data?.items.length ? (
						<Card className="min-w-0">
							<CardContent className="grid gap-3 px-5">
								<div className="flex items-center justify-between gap-3">
									<h2 className="font-serif font-semibold text-lg">
										{t.realms.pins}
									</h2>
									<PinIcon aria-hidden className="size-4 text-brand" />
								</div>
								{pins.data.items.map((pin) => (
									<div
										className="border-t pt-3 text-sm first:border-t-0 first:pt-0"
										key={pin.unitId}
									>
										<p className="font-medium">{t.realms.pinnedContent}</p>
										<p className="mt-1 text-muted-foreground text-xs">
											{t.realms.pinPosition}: {pin.position}
										</p>
									</div>
								))}
							</CardContent>
						</Card>
					) : null}
				</aside>
			</div>
		</main>
	);
}

function RealmActions({
	realm,
	ruleRevisionId,
	canManage,
}: {
	realm: GetApiRealmsByRealmIdStatus200;
	ruleRevisionId?: string;
	canManage: boolean;
}) {
	const { t, locale } = useTranslation([
		"actions",
		"feed",
		"media",
		"posts",
		"realms",
		"state",
		"ui",
	]);
	const queryClient = useQueryClient();
	const { data: session } = useHydratedSession();
	const join = usePutApiRealmsByRealmIdMembership();
	const leave = useDeleteApiRealmsByRealmIdMembership();
	const membership = realm.viewerMembership;

	if (!session)
		return <SignInButton destination={realmHref(realm)}>{t.realms.signInToJoin}</SignInButton>;

	return (
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
								join.mutate(
									{
										path: { realmId: realm.id },
										body: {
											language: toContentLanguage(locale.target),
											...(ruleRevisionId ? { ruleRevisionId } : {}),
										},
									},
									{
										onSuccess: () =>
											invalidateRealmDetails(queryClient, realm.id),
									},
								);
						}}
					>
						{membership ? t.realms.leave : t.realms.join}
					</Button>
				)}
				{canManage && (
					<Button asChild>
						<Link href={realmSettingsHref(realm)}>{t.realms.settings}</Link>
					</Button>
				)}
			</div>
			<RequestFailure error={join.error ?? leave.error} />
		</div>
	);
}
