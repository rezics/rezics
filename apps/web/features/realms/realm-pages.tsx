"use client";

import {
	useDeleteApiRealmsByRealmIdFollow,
	useDeleteApiRealmsByRealmIdMembership,
	useGetApiRealms,
	useGetApiRealmsByRealmId,
	useGetApiRealmsByRealmIdPins,
	useGetApiRealmsByRealmIdRules,
	usePostApiRealms,
	usePutApiRealmsByRealmIdFollow,
	usePutApiRealmsByRealmIdMembership,
	type GetApiRealmsByRealmIdStatus200,
} from "@rezics/openapi-tanstack-query";
import { PortableText } from "@portabletext/react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent } from "react";

import { PageHeading } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Card, CardContent } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { NativeSelect, NativeSelectOption } from "@rezics/ui";
import { Skeleton } from "@rezics/ui";
import { Textarea } from "@rezics/ui";
import { RequireSession } from "@/features/auth/require-session";
import { PostList } from "@/features/posts/post-list";
import { authClient } from "@/lib/auth-client";
import { selectLocalization } from "@/lib/localization";
import { toPortableTextForEditor } from "@/lib/portable-text";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { canManageRealm, isRealmOwner } from "./realm-permissions";
import { invalidateRealmDetails } from "./query";

export function RealmsPage() {
	const { t } = useTranslation({ suspense: true });
	const query = useGetApiRealms({ query: { limit: 20 } });
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
						<Link key={realm.id} href={`/realms/${realm.id}`}>
							<Card className="transition-colors hover:border-primary/30">
								<CardContent className="grid gap-2 p-5">
									<h2 className="font-semibold">
										{realm.title ?? realm.slug ?? t.realms.untitled}
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
	const { t, locale } = useTranslation({ suspense: true });
	const router = useRouter();
	const queryClient = useQueryClient();
	const create = usePostApiRealms();

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const title = String(data.get("title") ?? "").trim();
		const slug = String(data.get("slug") ?? "").trim();
		const summary = String(data.get("summary") ?? "").trim();
		if (!title || !slug) return;
		create.mutate(
			{
				body: {
					slug,
					localization: {
						language: locale.target,
						title,
						...(summary ? { summary } : {}),
					},
					visibility: "public",
					joinPolicy: data.get("joinPolicy") === "approval" ? "approval" : "open",
				},
			},
			{
				onSuccess: async (realm) => {
					await invalidateRealmDetails(queryClient, realm.id);
					router.push(`/realms/${realm.id}`);
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
						<Field required>
							<FieldLabel>{t.ui.slug}</FieldLabel>
							<Input
								name="slug"
								required
								minLength={3}
								maxLength={72}
								pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
							/>
						</Field>
						<Field>
							<FieldLabel>{t.ui.summary}</FieldLabel>
							<Textarea name="summary" maxLength={2000} />
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
	const { t, locale } = useTranslation({ suspense: true });
	const query = useGetApiRealmsByRealmId({ path: { realmId: id } });
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
	const localization = selectLocalization(realm.localizations, locale.target, realm.language);
	const canManage = canManageRealm(realm.viewerMembership);
	const canPost = realm.viewerMembership?.state === "active";
	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				title={localization?.title ?? realm.slug ?? t.realms.untitled}
				description={localization?.summary ?? undefined}
				action={
					<RealmActions
						realm={realm}
						ruleRevisionId={rules.data?.revisionId ?? undefined}
						canManage={canManage}
					/>
				}
			/>
			<div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
				<span>
					{t.realms.joinPolicy}:{" "}
					{realm.joinPolicy === "approval" ? t.realms.approval : t.realms.open}
				</span>
				{realm.viewerMembership?.state === "pending" && (
					<span>{t.realms.membershipPending}</span>
				)}
			</div>
			{rules.isError ? (
				<RequestFailure error={rules.error} />
			) : rules.data?.items.length ? (
				<section className="grid gap-3">
					<h2 className="font-heading text-xl font-bold">{t.realms.rules}</h2>
					{rules.data.items.map((rule) => (
						<Card key={rule.id}>
							<CardContent className="grid gap-2 p-5">
								<h3 className="font-semibold">{rule.title}</h3>
								<div className="prose prose-sm max-w-none">
									<PortableText value={toPortableTextForEditor(rule.content)} />
								</div>
							</CardContent>
						</Card>
					))}
				</section>
			) : null}
			{pins.isError ? (
				<RequestFailure error={pins.error} />
			) : pins.data?.items.length ? (
				<section className="grid gap-3">
					<h2 className="font-heading text-xl font-bold">{t.realms.pins}</h2>
					<div className="grid gap-2 sm:grid-cols-2">
						{pins.data.items.map((pin) => (
							<Card key={pin.unitId}>
								<CardContent className="grid gap-1 p-4 text-sm">
									<span className="font-medium">{t.realms.pinnedContent}</span>
									<span className="text-muted-foreground">
										{t.realms.pinPosition}: {pin.position}
									</span>
								</CardContent>
							</Card>
						))}
					</div>
				</section>
			) : null}
			<section className="grid gap-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 className="font-heading text-xl font-bold">{t.realms.feed}</h2>
					{canPost && (
						<Button size="sm" asChild>
							<Link href={`/posts/new?realmId=${realm.id}`}>{t.posts.create}</Link>
						</Button>
					)}
				</div>
				<PostList realmId={realm.id} />
			</section>
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
	const { t, locale } = useTranslation({ suspense: true });
	const queryClient = useQueryClient();
	const { data: session } = authClient.useSession();
	const follow = usePutApiRealmsByRealmIdFollow();
	const unfollow = useDeleteApiRealmsByRealmIdFollow();
	const join = usePutApiRealmsByRealmIdMembership();
	const leave = useDeleteApiRealmsByRealmIdMembership();
	const membership = realm.viewerMembership;

	if (!session)
		return (
			<Button asChild>
				<Link href={`/login?next=${encodeURIComponent(`/realms/${realm.id}`)}`}>
					{t.realms.signInToJoin}
				</Link>
			</Button>
		);

	return (
		<div className="flex flex-col items-end gap-2">
			<div className="flex flex-wrap justify-end gap-2">
				<Button
					variant="outline"
					isLoading={follow.isPending || unfollow.isPending}
					onClick={() => {
						const mutation = realm.viewerFollowing ? unfollow : follow;
						mutation.mutate(
							{ path: { realmId: realm.id } },
							{
								onSuccess: () => invalidateRealmDetails(queryClient, realm.id),
							},
						);
					}}
				>
					{realm.viewerFollowing ? t.realms.unfollow : t.realms.follow}
				</Button>
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
											language: locale.target,
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
						<Link href={`/realms/${realm.id}/settings`}>{t.realms.settings}</Link>
					</Button>
				)}
			</div>
			<RequestFailure error={follow.error ?? unfollow.error ?? join.error ?? leave.error} />
		</div>
	);
}
