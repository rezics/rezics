"use client";

import { toContentLanguage } from "@rezics/i18n";

import {
	useGetApiPostsByPostId,
	useGetApiRealmsByRealmId,
	usePatchApiPostsByPostId,
	usePatchApiPostsByPostIdRepliesByReplyPostId,
	usePostApiPosts,
	type GetApiPostsByPostIdStatus200,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import { useQueryClient } from "@tanstack/react-query";
import { HistoryIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { EntityPicker } from "@rezics/ui";
import { PageHeading } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { Button, Spinner } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { RequireSession } from "@/features/auth/require-session";
import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import { UnitAttributionProposalManager } from "@/features/governance/unit-workflows";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { readPortableText, writePortableText } from "@/lib/block";
import { selectLocalization } from "@/lib/localization";
import { PostList } from "./post-list";
import { invalidatePostQueries } from "./query";
import { postHref } from "./url";

type PickedEntity = { id: string; label: string };

export function PostsPage() {
	const { t } = useTranslation(["errors", "posts", "ui"]);
	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				title={t.posts.title}
				action={
					<Button variant="solid" asChild>
						<Link href="/posts/new">{t.posts.create}</Link>
					</Button>
				}
			/>
			<PostList />
		</main>
	);
}

export function PostCreatePage({ defaultRealmId }: { defaultRealmId?: string }) {
	const { t, locale } = useTranslation(["errors", "posts", "ui"]);
	const router = useRouter();
	const queryClient = useQueryClient();
	const create = usePostApiPosts();
	const defaultRealm = useGetApiRealmsByRealmId(
		{ path: { realmId: defaultRealmId ?? "" } },
		{ query: { enabled: Boolean(defaultRealmId) } },
	);
	const [realm, setRealm] = useState<PickedEntity>();
	const [subject, setSubject] = useState<PickedEntity>();
	const [body, setBody] = useState<PortableTextValue>([]);

	useEffect(() => {
		if (!defaultRealm.data || realm) return;
		const localization = selectLocalization(
			defaultRealm.data.localizations,
			toContentLanguage(locale.target),
			defaultRealm.data.language,
		);
		setRealm({
			id: defaultRealm.data.id,
			label: localization?.title ?? defaultRealm.data.id,
		});
	}, [defaultRealm.data, toContentLanguage(locale.target), realm]);

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const title = String(data.get("title") ?? "").trim();
		if (!title || !body.length) return;
		create.mutate(
			{
				body: {
					title,
					language: toContentLanguage(locale.target),
					body: writePortableText(body),
					...(realm ? { realmId: realm.id } : {}),
					...(subject ? { subjectId: subject.id } : {}),
				},
			},
			{
				onSuccess: async (post) => {
					await invalidatePostQueries(queryClient, post.id);
					router.push(postHref(post.id, realm?.id));
				},
			},
		);
	}

	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
				<PageHeading title={t.posts.createTitle} />
				<form onSubmit={submit}>
					<FieldGroup>
						<Field required>
							<FieldLabel>{t.ui.title}</FieldLabel>
							<Input name="title" required maxLength={500} />
						</Field>
						<Field>
							<FieldLabel>{t.posts.realm}</FieldLabel>
							<EntityPicker index="realms" value={realm} onChange={setRealm} />
							{realm && (
								<Button
									type="button"
									size="xs"
									variant="quiet"
									onClick={() => setRealm(undefined)}
								>
									{t.posts.clearRealm}
								</Button>
							)}
						</Field>
						<Field>
							<FieldLabel>{t.posts.subject}</FieldLabel>
							<EntityPicker index="units" value={subject} onChange={setSubject} />
							{subject && (
								<Button
									type="button"
									size="xs"
									variant="quiet"
									onClick={() => setSubject(undefined)}
								>
									{t.posts.clearSubject}
								</Button>
							)}
						</Field>
						<PostFields
							body={body}
							onBodyChange={setBody}
							submitLabel={t.posts.publish}
							pending={create.isPending}
							error={create.error}
						/>
					</FieldGroup>
				</form>
			</main>
		</RequireSession>
	);
}

export function PostEditPage({ id }: { id: string }) {
	return (
		<RequireSession>
			<PostEditLoader id={id} />
		</RequireSession>
	);
}

function PostEditLoader({ id }: { id: string }) {
	const { t } = useTranslation(["errors", "posts", "ui"]);
	const query = useGetApiPostsByPostId({ path: { postId: id } });
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data) return <QueryPending />;
	if (!query.data.capabilities.canEdit)
		return (
			<main className="mx-auto w-full max-w-2xl px-4 py-10">
				<p className="text-destructive text-sm">{t.errors.forbidden}</p>
			</main>
		);
	return query.data.postKind === "reply" ? (
		<ReplyPostEditForm key={query.data.id} post={query.data} />
	) : (
		<PostEditForm key={query.data.id} post={query.data} />
	);
}

function PostEditForm({ post }: { post: GetApiPostsByPostIdStatus200 }) {
	const { t } = useTranslation(["errors", "posts", "ui"]);
	const router = useRouter();
	const queryClient = useQueryClient();
	const update = usePatchApiPostsByPostId();
	const [body, setBody] = useState(() => readPortableText(post.body));

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const title = String(new FormData(event.currentTarget).get("title") ?? "").trim();
		if (!title || !body.length || !post.latestRevisionId) return;
		update.mutate(
			{
				path: { postId: post.id },
				body: {
					title,
					body: writePortableText(body, post.body),
					baseRevisionId: post.latestRevisionId,
				},
			},
			{
				onSuccess: async () => {
					await invalidatePostQueries(queryClient, post.id);
					router.push(`/posts/${post.id}`);
				},
			},
		);
	}

	return (
		<main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				action={
					<Button asChild size="icon-md" variant="outline">
						<Link aria-label={t.posts.history} href={`/posts/${post.id}/history`}>
							<HistoryIcon aria-hidden />
						</Link>
					</Button>
				}
				title={t.posts.editTitle}
			/>
			<form onSubmit={submit}>
				<FieldGroup>
					<Field required>
						<FieldLabel>{t.ui.title}</FieldLabel>
						<Input
							name="title"
							required
							maxLength={500}
							defaultValue={post.title ?? ""}
						/>
					</Field>
					<PostFields
						body={body}
						onBodyChange={setBody}
						submitLabel={t.ui.save}
						pending={update.isPending}
						error={update.error}
					/>
				</FieldGroup>
			</form>
			<UnitAttributionProposalManager unitId={post.id} />
		</main>
	);
}

function ReplyPostEditForm({ post }: { post: GetApiPostsByPostIdStatus200 }) {
	const { t } = useTranslation(["errors", "posts", "ui"]);
	const router = useRouter();
	const queryClient = useQueryClient();
	const update = usePatchApiPostsByPostIdRepliesByReplyPostId();
	const [body, setBody] = useState(() => readPortableText(post.body));
	const rootPostId = post.rootPostId;

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!rootPostId || !post.latestRevisionId || !body.length) return;
		update.mutate(
			{
				path: { postId: rootPostId, replyPostId: post.id },
				body: {
					body: writePortableText(body, post.body),
					baseRevisionId: post.latestRevisionId,
				},
			},
			{
				onSuccess: async () => {
					await invalidatePostQueries(queryClient, rootPostId, post.id);
					router.push(`/posts/${post.id}`);
				},
			},
		);
	}

	return (
		<main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				action={
					<Button asChild size="icon-md" variant="outline">
						<Link aria-label={t.posts.history} href={`/posts/${post.id}/history`}>
							<HistoryIcon aria-hidden />
						</Link>
					</Button>
				}
				title={t.posts.editReplyTitle}
			/>
			<form onSubmit={submit}>
				<FieldGroup>
					<PortableTextEditor
						label={t.posts.replyBody}
						onChange={setBody}
						required
						value={body}
					/>
					<RequestFailure error={update.error} />
					<Button
						variant="solid"
						type="submit"
						className="w-fit"
						disabled={!body.length || update.isPending}
					>
						{update.isPending && <Spinner data-icon="inline-start" />}
						{t.ui.save}
					</Button>
				</FieldGroup>
			</form>
			<UnitAttributionProposalManager unitId={post.id} />
		</main>
	);
}

function PostFields({
	body,
	onBodyChange,
	submitLabel,
	pending,
	error,
}: {
	body: PortableTextValue;
	onBodyChange: (value: PortableTextValue) => void;
	submitLabel: string;
	pending: boolean;
	error: Parameters<typeof RequestFailure>[0]["error"];
}) {
	const { t } = useTranslation(["errors", "posts", "ui"]);
	return (
		<>
			<PortableTextEditor label={t.ui.body} onChange={onBodyChange} required value={body} />
			<RequestFailure error={error} />
			<Button
				variant="solid"
				type="submit"
				className="w-fit"
				disabled={!body.length || pending}
			>
				{pending && <Spinner data-icon="inline-start" />}
				{submitLabel}
			</Button>
		</>
	);
}
