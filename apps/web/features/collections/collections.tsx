"use client";

import { toContentLanguage } from "@rezics/i18n";

import {
	getApiCollectionsByCollectionIdQueryKey,
	getApiCollectionsFavoritesQueryKey,
	getApiCollectionsQueryKey,
	useDeleteApiCollectionsByCollectionId,
	useDeleteApiCollectionsByCollectionIdItemsByTargetId,
	useGetApiCollections,
	useGetApiCollectionsByCollectionId,
	useGetApiCollectionsFavorites,
	useGetApiUsersMe,
	usePatchApiCollectionsByCollectionId,
	usePostApiCollections,
	usePutApiCollectionsByCollectionIdItemsByTargetId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { ChoiceSelect, Cover, EntityPicker, UnitList } from "@rezics/ui";
import { PageHeading } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogBody,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Card, CardAction, CardContent, CardHeader } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { Textarea } from "@rezics/ui";
import { RequireSession } from "@/features/auth/require-session";
import { realmHref } from "@/features/slugs/unit-route";
import {
	LocalizationImageUploadField,
	type LocalizationImageAssetValue,
} from "@/features/media/components/localization-image-upload-field";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { selectLocalization } from "@/lib/localization";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { FavoriteButton } from "./components/favorite-button";
import { CollectionItemCard } from "./components/collection-item-card";

const CollectionStatuses = ["draft", "published", "archived"] as const;
const CollectionVisibilities = ["public", "unlisted", "private"] as const;

function getCollectionVisibility(value: FormDataEntryValue | null) {
	return CollectionVisibilities.find((visibility) => visibility === value) ?? "private";
}

function getItemHref(type: string, id: string) {
	switch (type.toLowerCase()) {
		case "book":
		case "software":
		case "media":
			return `/units/${type.toLowerCase()}/${id}`;
		case "entity":
			return `/entities/${id}`;
		case "realm":
			return realmHref({ id });
		case "post":
			return `/posts/${id}`;
		case "poll":
			return `/polls/${id}`;
		case "review":
			return `/reviews/${id}`;
		case "collection":
			return `/collections/${id}`;
		default:
			return undefined;
	}
}

async function invalidateCollections(queryClient: ReturnType<typeof useQueryClient>, id?: string) {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: getApiCollectionsQueryKey() }),
		queryClient.invalidateQueries({ queryKey: getApiCollectionsFavoritesQueryKey() }),
		...(id
			? [
					queryClient.invalidateQueries({
						queryKey: getApiCollectionsByCollectionIdQueryKey({
							path: { collectionId: id },
						}),
					}),
				]
			: []),
	]);
}

function CollectionFields({
	cover,
	onCoverChange,
	initial,
	includeStatus,
}: {
	cover: LocalizationImageAssetValue | null;
	onCoverChange: (value: LocalizationImageAssetValue | null) => void;
	initial?: {
		title?: string | null;
		summary?: string | null;
		visibility?: string;
		status?: string;
	};
	includeStatus?: boolean;
}) {
	const { t } = useTranslation(["actions", "cover", "engagement", "errors", "ui"]);
	const [visibility, setVisibility] = useState(
		getCollectionVisibility(initial?.visibility ?? null),
	);
	const [status, setStatus] = useState(
		CollectionStatuses.find((value) => value === initial?.status) ?? "draft",
	);
	const visibilityOptions = [
		{ value: "public", label: t.ui.public },
		{ value: "unlisted", label: t.ui.unlisted },
		{ value: "private", label: t.ui.private },
	] as const;
	const statusOptions = [
		{ value: "draft", label: t.ui.draft },
		{ value: "published", label: t.ui.published },
		{ value: "archived", label: t.ui.archived },
	] as const;
	return (
		<FieldGroup>
			<Field>
				<FieldLabel>{t.cover.title}</FieldLabel>
				<LocalizationImageUploadField onChange={onCoverChange} role="cover" value={cover} />
			</Field>
			<Field required>
				<FieldLabel>{t.ui.title}</FieldLabel>
				<Input defaultValue={initial?.title ?? ""} maxLength={500} name="title" required />
			</Field>
			<Field>
				<FieldLabel>{t.ui.summary}</FieldLabel>
				<Textarea defaultValue={initial?.summary ?? ""} maxLength={2000} name="summary" />
			</Field>
			<Field>
				<FieldLabel>{t.ui.visibility}</FieldLabel>
				<ChoiceSelect
					appearance="field"
					ariaLabel={t.ui.visibility}
					className="w-full"
					name="visibility"
					onValueChange={([nextVisibility]) => {
						if (nextVisibility) setVisibility(nextVisibility);
					}}
					options={visibilityOptions}
					placeholder={t.ui.visibility}
					value={[visibility]}
				/>
			</Field>
			{includeStatus && (
				<Field>
					<FieldLabel>{t.ui.status}</FieldLabel>
					<ChoiceSelect
						appearance="field"
						ariaLabel={t.ui.status}
						className="w-full"
						name="status"
						onValueChange={([nextStatus]) => {
							if (nextStatus) setStatus(nextStatus);
						}}
						options={statusOptions}
						placeholder={t.ui.status}
						value={[status]}
					/>
				</Field>
			)}
		</FieldGroup>
	);
}

export function CollectionsPage() {
	const query = useGetApiCollections({ query: { limit: 50 } });
	const { t } = useTranslation(["actions", "cover", "engagement", "errors", "ui"]);
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				title={t.engagement.collections}
				action={
					<Button variant="solid" asChild>
						<Link href="/collections/new">{t.engagement.newCollection}</Link>
					</Button>
				}
			/>
			<UnitList
				error={false}
				href={(collection) => `/collections/${collection.id}`}
				items={query.data?.items}
				pending={false}
				variant="shelf"
			/>
		</main>
	);
}

export function CollectionCreate() {
	const create = usePostApiCollections();
	const queryClient = useQueryClient();
	const router = useRouter();
	const { locale, t } = useTranslation(["actions", "cover", "engagement", "errors", "ui"]);
	const [cover, setCover] = useState<LocalizationImageAssetValue | null>(null);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		try {
			const result = await create.mutateAsync({
				body: {
					localization: {
						language: toContentLanguage(locale.target),
						title: String(form.get("title") ?? "").trim(),
						coverAssetId: cover?.id ?? null,
						...(String(form.get("summary") ?? "").trim()
							? { summary: String(form.get("summary") ?? "").trim() }
							: {}),
					},
					visibility: getCollectionVisibility(form.get("visibility")),
				},
			});
			await invalidateCollections(queryClient, result.id);
			router.push(`/collections/${result.id}`);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
				<PageHeading title={t.engagement.newCollection} />
				<form className="flex flex-col gap-6" onSubmit={(event) => void submit(event)}>
					<CollectionFields cover={cover} onCoverChange={setCover} />
					<RequestFailure error={create.error} fallback={t.ui.retryLater} />
					<Button variant="solid" isLoading={create.isPending} type="submit">
						{t.ui.create}
					</Button>
				</form>
			</main>
		</RequireSession>
	);
}

export function CollectionDetail({ id }: { id: string }) {
	const query = useGetApiCollectionsByCollectionId({ path: { collectionId: id } });
	const { data: session } = useHydratedSession();
	const me = useGetApiUsersMe({ query: { enabled: Boolean(session) } });
	const { locale, t } = useTranslation(["actions", "cover", "engagement", "errors", "ui"]);
	const queryClient = useQueryClient();
	const addItem = usePutApiCollectionsByCollectionIdItemsByTargetId();
	const removeItem = useDeleteApiCollectionsByCollectionIdItemsByTargetId();
	const removeCollection = useDeleteApiCollectionsByCollectionId();
	const router = useRouter();
	const [target, setTarget] = useState<{ id: string; label: string }>();
	const [kind, setKind] = useState("item");
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data) return null;
	const collection = query.data;
	const canManage = me.data?.id === collection.ownerId;
	const localization = selectLocalization(
		collection.localizations,
		toContentLanguage(locale.target),
		collection.language,
	);
	async function addSelectedItem() {
		if (!target) return;
		try {
			await addItem.mutateAsync({
				path: { collectionId: id, targetId: target.id },
				body: { kind },
			});
			setTarget(undefined);
			await invalidateCollections(queryClient, id);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	async function deleteCollection() {
		try {
			await removeCollection.mutateAsync({ path: { collectionId: id } });
			await invalidateCollections(queryClient, id);
			router.push("/collections");
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	async function removeCollectionItem(targetId: string) {
		try {
			await removeItem.mutateAsync({ path: { collectionId: id, targetId } });
			await invalidateCollections(queryClient, id);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				title={localization?.title ?? t.ui.unnamed}
				description={localization?.summary ?? undefined}
				action={
					canManage ? (
						<div className="flex shrink-0 flex-wrap gap-2">
							<Button asChild variant="outline">
								<Link href={`/collections/${id}/edit`}>{t.ui.edit}</Link>
							</Button>
							<AlertDialog>
								<AlertDialogTrigger asChild>
									<Button variant="destructive">
										{t.engagement.deleteCollection}
									</Button>
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>
											{t.engagement.deleteCollection}
										</AlertDialogTitle>
									</AlertDialogHeader>
									<AlertDialogBody>
										<AlertDialogDescription>
											{t.engagement.deleteCollectionPrompt}
										</AlertDialogDescription>
									</AlertDialogBody>
									<AlertDialogFooter>
										<AlertDialogCancel>{t.engagement.cancel}</AlertDialogCancel>
										<AlertDialogAction
											isLoading={removeCollection.isPending}
											onClick={() => void deleteCollection()}
											variant="destructive"
										>
											{t.engagement.delete}
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						</div>
					) : undefined
				}
			/>
			{localization?.cover ? (
				<div className="w-32 sm:w-40">
					<Cover
						alt={localization.title ?? t.ui.unnamed}
						className="rounded-xl border border-border-weak"
						src={localization.cover.url}
					/>
				</div>
			) : null}
			{canManage && (
				<Card>
					<CardHeader title={t.engagement.addItem} />
					<CardContent className="flex flex-col gap-4">
						<EntityPicker index="units" onChange={setTarget} value={target} />
						<div className="flex flex-wrap items-end gap-3">
							<Field className="w-full max-w-48">
								<FieldLabel>{t.engagement.itemKind}</FieldLabel>
								<Input
									maxLength={32}
									onChange={(event) => setKind(event.currentTarget.value)}
									value={kind}
								/>
							</Field>
							<Button
								variant="solid"
								disabled={!target}
								isLoading={addItem.isPending}
								onClick={() => void addSelectedItem()}
							>
								{t.engagement.addItem}
							</Button>
						</div>
						<RequestFailure error={addItem.error} fallback={t.ui.retryLater} />
					</CardContent>
				</Card>
			)}
			{collection.items.length ? (
				<div className="grid gap-3">
					{collection.items.map((item) => {
						return (
							<CollectionItemCard
								canManage={canManage}
								item={item}
								key={item.targetId}
								onRemove={() => void removeCollectionItem(item.targetId)}
								removePending={removeItem.isPending}
							/>
						);
					})}
				</div>
			) : (
				<p className="text-muted-foreground text-sm">{t.engagement.emptyCollection}</p>
			)}
			<RequestFailure
				error={removeItem.error ?? removeCollection.error}
				fallback={t.ui.retryLater}
			/>
		</main>
	);
}

export function CollectionEdit({ id }: { id: string }) {
	const query = useGetApiCollectionsByCollectionId({ path: { collectionId: id } });
	const { data: session } = useHydratedSession();
	const me = useGetApiUsersMe({ query: { enabled: Boolean(session) } });
	const update = usePatchApiCollectionsByCollectionId();
	const queryClient = useQueryClient();
	const router = useRouter();
	const { locale, t } = useTranslation(["actions", "cover", "engagement", "errors", "ui"]);
	const localization = query.data
		? selectLocalization(
				query.data.localizations,
				toContentLanguage(locale.target),
				query.data.language,
			)
		: undefined;
	const [cover, setCover] = useState<LocalizationImageAssetValue | null>(null);
	useEffect(
		() => setCover(localization?.cover ?? null),
		[localization?.cover?.id, localization?.cover?.url],
	);
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data) return null;
	const collection = query.data;
	if (session && me.isPending) return <QueryPending />;
	if (session && me.data?.id !== collection.ownerId)
		return (
			<main className="mx-auto grid min-h-64 w-full max-w-4xl place-items-center px-4 py-10">
				<p className="text-destructive text-sm">{t.errors.forbidden}</p>
			</main>
		);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const status = CollectionStatuses.find((value) => value === form.get("status")) ?? "draft";
		try {
			await update.mutateAsync({
				path: { collectionId: id },
				body: {
					status,
					visibility: getCollectionVisibility(form.get("visibility")),
					localization: {
						language: toContentLanguage(locale.target),
						title: String(form.get("title") ?? "").trim(),
						coverAssetId: cover?.id ?? null,
						...(String(form.get("summary") ?? "").trim()
							? { summary: String(form.get("summary") ?? "").trim() }
							: {}),
					},
				},
			});
			await invalidateCollections(queryClient, id);
			router.push(`/collections/${id}`);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
				<PageHeading title={t.engagement.editCollection} />
				<form className="flex flex-col gap-6" onSubmit={(event) => void submit(event)}>
					<CollectionFields
						cover={cover}
						includeStatus
						initial={{
							title: localization?.title,
							summary: localization?.summary,
							status: collection.status,
							visibility: collection.visibility,
						}}
						onCoverChange={setCover}
					/>
					<RequestFailure error={update.error} fallback={t.ui.retryLater} />
					<Button variant="solid" isLoading={update.isPending} type="submit">
						{t.ui.save}
					</Button>
				</form>
			</main>
		</RequireSession>
	);
}

export function FavoritesPage() {
	return (
		<RequireSession>
			<FavoritesList />
		</RequireSession>
	);
}

function FavoritesList() {
	const query = useGetApiCollectionsFavorites();
	const { t } = useTranslation(["actions", "cover", "engagement", "errors", "ui"]);
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading title={t.engagement.favorites} />
			{query.data?.items.length ? (
				<div className="grid gap-3">
					{query.data.items.map((item) => {
						const href = getItemHref(item.type, item.targetId);
						return (
							<Card key={item.targetId}>
								<CardHeader
									description={item.type}
									title={item.title ?? t.ui.unnamed}
								>
									<CardAction>
										<div className="flex gap-2">
											{href && (
												<Button asChild size="sm" variant="outline">
													<Link href={href}>{t.engagement.select}</Link>
												</Button>
											)}
											<FavoriteButton targetId={item.targetId} />
										</div>
									</CardAction>
								</CardHeader>
							</Card>
						);
					})}
				</div>
			) : (
				<p className="text-muted-foreground text-sm">{t.ui.emptyFavorites}</p>
			)}
		</main>
	);
}
