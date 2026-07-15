"use client";

import {
	getApiEntitiesQueryKey,
	getApiTagsQueryKey,
	useGetApiEntities,
	useGetApiEntitiesByUnitId,
	useGetApiTags,
	usePostApiEntities,
	usePostApiTags,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { PageHeading } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { UnitList } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Card, CardContent } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { NativeSelect, NativeSelectOption } from "@rezics/ui";
import { Textarea } from "@rezics/ui";
import { RequireSession } from "@/features/auth/require-session";
import { useTranslation } from "@/i18n/client";
import { selectLocalization } from "@/lib/localization";

function CatalogFrame({
	title,
	createHref,
	children,
}: {
	title: string;
	createHref?: string;
	children: React.ReactNode;
}) {
	const { t } = useTranslation({ suspense: true });
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				title={title}
				action={
					createHref ? (
						<Button asChild>
							<Link href={createHref}>{t.actions.create}</Link>
						</Button>
					) : undefined
				}
			/>
			{children}
		</main>
	);
}

export function EntitiesPage() {
	const { t } = useTranslation({ suspense: true });
	const query = useGetApiEntities({ query: { limit: 50 } });
	return (
		<CatalogFrame title={t.catalog.entities} createHref="/entities/new">
			<UnitList
				items={query.data?.items}
				pending={query.isPending}
				error={query.isError}
				href={(item) => `/entities/${item.id}`}
			/>
		</CatalogFrame>
	);
}

export function TagsPage() {
	const { t } = useTranslation({ suspense: true });
	const query = useGetApiTags({ query: { limit: 50 } });
	return (
		<CatalogFrame title={t.catalog.tags} createHref="/tags/new">
			<UnitList items={query.data?.items} pending={query.isPending} error={query.isError} />
		</CatalogFrame>
	);
}

export function EntityDetailPage({ id }: { id: string }) {
	const { t, locale } = useTranslation({ suspense: true });
	const query = useGetApiEntitiesByUnitId({ path: { unitId: id } });
	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	const localization = selectLocalization(query.data.localizations, locale.target);
	return (
		<CatalogFrame title={localization?.title ?? query.data.slug ?? t.ui.unnamed}>
			<Card>
				<CardContent className="grid gap-3 p-5 text-sm">
					<p>
						<span className="text-muted-foreground">{t.catalog.kind}</span>{" "}
						{query.data.kind}
					</p>
					<p>
						<span className="text-muted-foreground">{t.catalog.verification}</span>{" "}
						{query.data.verified ? t.catalog.verified : t.catalog.unverified}
					</p>
					{localization?.summary && <p>{localization.summary}</p>}
				</CardContent>
			</Card>
		</CatalogFrame>
	);
}

function CreateFrame({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
				<PageHeading title={title} />
				{children}
			</main>
		</RequireSession>
	);
}

export function EntityCreatePage() {
	const { t, locale } = useTranslation({ suspense: true });
	const router = useRouter();
	const queryClient = useQueryClient();
	const [error, setError] = useState(false);
	const create = usePostApiEntities({
		mutation: {
			onSuccess: async (result) => {
				await queryClient.invalidateQueries({ queryKey: getApiEntitiesQueryKey() });
				router.push(`/entities/${result.id}`);
			},
		},
	});
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(false);
		const form = new FormData(event.currentTarget);
		try {
			await create.mutateAsync({
				body: {
					kind: String(form.get("kind") ?? "person"),
					localization: {
						language: locale.target,
						title: String(form.get("title") ?? "").trim(),
						...(String(form.get("summary") ?? "").trim()
							? { summary: String(form.get("summary")).trim() }
							: {}),
					},
					...(String(form.get("slug") ?? "").trim()
						? { slug: String(form.get("slug")).trim() }
						: {}),
				},
			});
		} catch {
			setError(true);
		}
	}
	return (
		<CreateFrame title={t.catalog.newEntity}>
			<form onSubmit={submit}>
				<FieldGroup>
					<Field required>
						<FieldLabel>{t.ui.title}</FieldLabel>
						<Input name="title" required maxLength={500} />
					</Field>
					<Field required>
						<FieldLabel>{t.catalog.kind}</FieldLabel>
						<NativeSelect name="kind" defaultValue="person">
							<NativeSelectOption value="person">{t.ui.person}</NativeSelectOption>
							<NativeSelectOption value="organization">
								{t.ui.organization}
							</NativeSelectOption>
							<NativeSelectOption value="character">
								{t.ui.character}
							</NativeSelectOption>
						</NativeSelect>
					</Field>
					<Field>
						<FieldLabel>{t.ui.slug}</FieldLabel>
						<Input name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" />
					</Field>
					<Field>
						<FieldLabel>{t.ui.summary}</FieldLabel>
						<Textarea name="summary" maxLength={2000} />
					</Field>
					{error && <p className="text-destructive text-sm">{t.ui.retryLater}</p>}
					<Button type="submit" isLoading={create.isPending}>
						{t.ui.submit}
					</Button>
				</FieldGroup>
			</form>
		</CreateFrame>
	);
}

export function TagCreatePage() {
	const { t, locale } = useTranslation({ suspense: true });
	const router = useRouter();
	const queryClient = useQueryClient();
	const [error, setError] = useState(false);
	const create = usePostApiTags({
		mutation: {
			onSuccess: async () => {
				await queryClient.invalidateQueries({ queryKey: getApiTagsQueryKey() });
				router.push("/tags");
			},
		},
	});
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(false);
		const form = new FormData(event.currentTarget);
		try {
			await create.mutateAsync({
				body: {
					localization: {
						language: locale.target,
						title: String(form.get("title") ?? "").trim(),
						...(String(form.get("summary") ?? "").trim()
							? { summary: String(form.get("summary")).trim() }
							: {}),
					},
					...(String(form.get("slug") ?? "").trim()
						? { slug: String(form.get("slug")).trim() }
						: {}),
				},
			});
		} catch {
			setError(true);
		}
	}
	return (
		<CreateFrame title={t.catalog.newTag}>
			<form onSubmit={submit}>
				<FieldGroup>
					<Field required>
						<FieldLabel>{t.ui.title}</FieldLabel>
						<Input name="title" required maxLength={500} />
					</Field>
					<Field>
						<FieldLabel>{t.ui.slug}</FieldLabel>
						<Input name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" />
					</Field>
					<Field>
						<FieldLabel>{t.ui.summary}</FieldLabel>
						<Textarea name="summary" maxLength={2000} />
					</Field>
					{error && <p className="text-destructive text-sm">{t.ui.retryLater}</p>}
					<Button type="submit" isLoading={create.isPending}>
						{t.ui.submit}
					</Button>
				</FieldGroup>
			</form>
		</CreateFrame>
	);
}
