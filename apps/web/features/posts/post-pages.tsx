"use client";

import {
	useDeleteApiPostsByPostId,
	useDeleteApiPostsByPostIdRepliesByReplyPostId,
	useGetApiPostsByPostId,
	useGetApiRealmsByRealmId,
	usePatchApiPostsByPostId,
	usePatchApiPostsByPostIdRepliesByReplyPostId,
	usePostApiPosts,
	type GetApiPostsByPostIdStatus200,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextBlock } from "@portabletext/editor";
import { PortableText } from "@portabletext/react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { EntityPicker } from "@rezics/ui";
import { PageHeading } from "@rezics/ui";
import { PortableTextEditor } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Card, CardContent, CardDescription, CardHeader, Spinner } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { RequireSession } from "@/features/auth/require-session";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { selectLocalization } from "@/lib/localization";
import {
	toPortableTextFromEditor,
	toPortableTextForEditor,
	toPortableTextForReact,
} from "@/lib/portable-text";
import { ReplyPostThread } from "./reply-thread";
import { PostList, RelatedPostRecommendations } from "./post-list";
import { invalidatePostQueries } from "./query";

type PickedEntity = { id: string; label: string };

export function PostsPage() {
	const { t } = useTranslation({ suspense: true });
	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				title={t.posts.title}
				action={
					<Button asChild>
						<Link href="/posts/new">{t.posts.create}</Link>
					</Button>
				}
			/>
			<PostList />
		</main>
	);
}

export function PostCreatePage({ defaultRealmId }: { defaultRealmId?: string }) {
	const { t, locale } = useTranslation({ suspense: true });
	const router = useRouter();
	const queryClient = useQueryClient();
	const create = usePostApiPosts();
	const defaultRealm = useGetApiRealmsByRealmId(
		{ path: { realmId: defaultRealmId ?? "" } },
		{ query: { enabled: Boolean(defaultRealmId) } },
	);
	const [realm, setRealm] = useState<PickedEntity>();
	const [subject, setSubject] = useState<PickedEntity>();
	const [body, setBody] = useState<PortableTextBlock[]>([]);

	useEffect(() => {
		if (!defaultRealm.data || realm) return;
		const localization = selectLocalization(
			defaultRealm.data.localizations,
			locale.target,
			defaultRealm.data.language,
		);
		setRealm({
			id: defaultRealm.data.id,
			label: localization?.title ?? defaultRealm.data.slug ?? defaultRealm.data.id,
		});
	}, [defaultRealm.data, locale.target, realm]);

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const title = String(data.get("title") ?? "").trim();
		if (!title || !body.length) return;
		create.mutate(
			{
				body: {
					title,
					language: locale.target,
					body: toPortableTextFromEditor(body),
					...(realm ? { realmId: realm.id } : {}),
					...(subject ? { subjectId: subject.id } : {}),
				},
			},
			{
				onSuccess: async (post) => {
					await invalidatePostQueries(queryClient, post.id);
					router.push(`/posts/${post.id}`);
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
									variant="ghost"
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
									variant="ghost"
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

export function PostDetailPage({ id }: { id: string }) {
	const { t } = useTranslation({ suspense: true });
	const query = useGetApiPostsByPostId({ path: { postId: id } });
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data) return <QueryPending />;
	const post = query.data;
	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				title={
					post.postKind === "reply" ? t.posts.replyPost : (post.title ?? t.posts.untitled)
				}
				action={
					<div className="flex flex-wrap gap-2">
						<Button variant="outline" asChild>
							<Link href={`/posts/${post.id}/history`}>{t.posts.history}</Link>
						</Button>
						{post.capabilities.canEdit && (
							<>
								<Button variant="outline" asChild>
									<Link href={`/posts/${post.id}/edit`}>{t.ui.edit}</Link>
								</Button>
								<PostDeleteButton postId={post.id} rootPostId={post.rootPostId} />
							</>
						)}
					</div>
				}
			/>
			<Card>
				<CardHeader>
					<CardDescription className="flex flex-wrap gap-x-4 gap-y-2">
						<Link className="text-primary" href={`/users/${post.authorId}`}>
							{t.posts.author}
						</Link>
						{post.realmId && (
							<Link className="text-primary" href={`/realms/${post.realmId}`}>
								{t.posts.viewRealm}
							</Link>
						)}
						<span className="text-muted-foreground">
							{post.replyCount} {t.posts.replies}
						</span>
						{post.rootPostId && (
							<Link
								className="text-primary"
								href={`/posts/${post.rootPostId}#replies`}
							>
								{t.posts.viewThread}
							</Link>
						)}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<article className="prose max-w-none">
						<PortableText value={toPortableTextForReact(post.body)} />
					</article>
				</CardContent>
			</Card>
			<ReplyPostThread
				rootPostId={post.rootPostId ?? post.id}
				parentPostId={post.postKind === "reply" ? post.id : undefined}
			/>
			<RelatedPostRecommendations postId={post.id} />
		</main>
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
	const { t } = useTranslation({ suspense: true });
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
	const { t } = useTranslation({ suspense: true });
	const router = useRouter();
	const queryClient = useQueryClient();
	const update = usePatchApiPostsByPostId();
	const [body, setBody] = useState(() => toPortableTextForEditor(post.body));

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const title = String(new FormData(event.currentTarget).get("title") ?? "").trim();
		if (!title || !body.length || !post.latestRevisionId) return;
		update.mutate(
			{
				path: { postId: post.id },
				body: {
					title,
					body: toPortableTextFromEditor(body),
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
			<PageHeading title={t.posts.editTitle} />
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
		</main>
	);
}

function ReplyPostEditForm({ post }: { post: GetApiPostsByPostIdStatus200 }) {
	const { t } = useTranslation({ suspense: true });
	const router = useRouter();
	const queryClient = useQueryClient();
	const update = usePatchApiPostsByPostIdRepliesByReplyPostId();
	const [body, setBody] = useState(() => toPortableTextForEditor(post.body));
	const rootPostId = post.rootPostId;

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!rootPostId || !post.latestRevisionId || !body.length) return;
		update.mutate(
			{
				path: { postId: rootPostId, replyPostId: post.id },
				body: {
					body: toPortableTextFromEditor(body),
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
			<PageHeading title={t.posts.editReplyTitle} />
			<form onSubmit={submit}>
				<FieldGroup>
					<Field required>
						<FieldLabel>{t.posts.replyBody}</FieldLabel>
						<PortableTextEditor value={body} onChange={setBody} />
					</Field>
					<RequestFailure error={update.error} />
					<Button
						type="submit"
						className="w-fit"
						disabled={!body.length || update.isPending}
					>
						{update.isPending && <Spinner data-icon="inline-start" />}
						{t.ui.save}
					</Button>
				</FieldGroup>
			</form>
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
	body: PortableTextBlock[];
	onBodyChange: (value: PortableTextBlock[]) => void;
	submitLabel: string;
	pending: boolean;
	error: Parameters<typeof RequestFailure>[0]["error"];
}) {
	const { t } = useTranslation({ suspense: true });
	return (
		<>
			<Field required>
				<FieldLabel>{t.ui.body}</FieldLabel>
				<PortableTextEditor value={body} onChange={onBodyChange} />
			</Field>
			<RequestFailure error={error} />
			<Button type="submit" className="w-fit" disabled={!body.length || pending}>
				{pending && <Spinner data-icon="inline-start" />}
				{submitLabel}
			</Button>
		</>
	);
}

function PostDeleteButton({ postId, rootPostId }: { postId: string; rootPostId: string | null }) {
	const { t } = useTranslation({ suspense: true });
	const router = useRouter();
	const queryClient = useQueryClient();
	const removePost = useDeleteApiPostsByPostId();
	const removeReply = useDeleteApiPostsByPostIdRepliesByReplyPostId();
	const pending = removePost.isPending || removeReply.isPending;
	const error = rootPostId ? removeReply.error : removePost.error;
	const onSuccess = async () => {
		await invalidatePostQueries(queryClient, rootPostId ?? postId, postId);
		router.replace(rootPostId ? `/posts/${rootPostId}#replies` : "/posts");
	};
	const remove = () => {
		if (rootPostId) {
			removeReply.mutate(
				{ path: { postId: rootPostId, replyPostId: postId } },
				{ onSuccess },
			);
			return;
		}
		removePost.mutate({ path: { postId } }, { onSuccess });
	};
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button variant="destructive">{t.posts.delete}</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t.posts.deleteTitle}</AlertDialogTitle>
					<AlertDialogDescription>{t.posts.deleteDescription}</AlertDialogDescription>
				</AlertDialogHeader>
				<RequestFailure error={error} />
				<AlertDialogFooter>
					<AlertDialogCancel>{t.posts.cancel}</AlertDialogCancel>
					<Button
						type="button"
						variant="destructive"
						isLoading={pending}
						onClick={remove}
					>
						{t.posts.delete}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
