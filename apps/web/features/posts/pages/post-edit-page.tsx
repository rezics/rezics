"use client";

import {
	usePatchApiPostsByPostId,
	usePatchApiPostsByPostIdRepliesByReplyPostId,
	type GetApiPostsByPostIdStatus200,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import { Button, Field, FieldGroup, FieldLabel, Input, Spinner } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import { useContentLanguageEditor } from "@/features/content-languages/hooks/use-content-language-editor";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { readPortableText, writePortableText } from "@/lib/block";
import { PostEditorFields } from "../components/post-editor-fields";
import { PostManagementSectionHeader } from "../components/post-management-section-header";
import { useOrdinaryPostManagement } from "../components/post-management-workspace";
import { invalidatePostQueries } from "../query";
import { postDetailHref } from "../routing/post-management-routes";

export function PostEditPage() {
	const { t } = useTranslation(["errors", "posts"]);
	const { item: post } = useOrdinaryPostManagement();
	const { selectedLanguage } = useContentLanguageEditor();
	if (!post.capabilities.canEdit)
		return <p className="text-sm text-destructive">{t.errors.forbidden}</p>;
	const description =
		post.postKind === "reply"
			? t.posts.workspace.sections.main.replyDescription
			: t.posts.workspace.sections.main.postDescription;
	return (
		<section>
			<PostManagementSectionHeader
				description={description}
				title={post.postKind === "reply" ? t.posts.editReplyTitle : t.posts.editTitle}
			/>
			{post.postKind === "reply" ? (
				<ReplyPostEditForm key={`${post.id}:${selectedLanguage}`} post={post} />
			) : (
				<OrdinaryPostEditForm key={`${post.id}:${selectedLanguage}`} post={post} />
			)}
		</section>
	);
}

function OrdinaryPostEditForm({ post }: { post: GetApiPostsByPostIdStatus200 }) {
	const { t } = useTranslation(["posts", "ui"]);
	const router = useRouter();
	const queryClient = useQueryClient();
	const update = usePatchApiPostsByPostId();
	const { selectedLanguage, selectedLanguageIsPending, setDirty, languagesChanged } =
		useContentLanguageEditor();
	const [body, setBody] = useState<PortableTextValue>(() =>
		readPortableText(selectedLanguageIsPending ? null : post.body),
	);

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const title = String(new FormData(event.currentTarget).get("title") ?? "").trim();
		if (!title || !body.length || !post.latestRevisionId) return;
		update.mutate(
			{
				path: { postId: post.id },
				body: {
					language: selectedLanguage,
					title,
					body: writePortableText(
						body,
						selectedLanguageIsPending ? undefined : post.body,
					),
					baseRevisionId: post.latestRevisionId,
				},
			},
			{
				onSuccess: async () => {
					setDirty(false);
					await invalidatePostQueries(queryClient, post.id);
					await languagesChanged();
					router.push(postDetailHref("post", post.id));
				},
			},
		);
	}

	return (
		<form onChange={() => setDirty(true)} onSubmit={submit}>
			<FieldGroup>
				<Field required>
					<FieldLabel>{t.ui.title}</FieldLabel>
					<Input
						defaultValue={selectedLanguageIsPending ? "" : (post.title ?? "")}
						maxLength={500}
						name="title"
						required
					/>
				</Field>
				<PostEditorFields
					body={body}
					error={update.error}
					onBodyChange={(value) => {
						setBody(value);
						setDirty(true);
					}}
					pending={update.isPending}
					submitLabel={t.ui.save}
				/>
			</FieldGroup>
		</form>
	);
}

function ReplyPostEditForm({ post }: { post: GetApiPostsByPostIdStatus200 }) {
	const { t } = useTranslation(["posts", "ui"]);
	const router = useRouter();
	const queryClient = useQueryClient();
	const update = usePatchApiPostsByPostIdRepliesByReplyPostId();
	const { selectedLanguage, selectedLanguageIsPending, setDirty, languagesChanged } =
		useContentLanguageEditor();
	const [body, setBody] = useState<PortableTextValue>(() =>
		readPortableText(selectedLanguageIsPending ? null : post.body),
	);
	const rootPostId = post.rootPostId;

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!rootPostId || !post.latestRevisionId || !body.length) return;
		update.mutate(
			{
				path: { postId: rootPostId, replyPostId: post.id },
				body: {
					language: selectedLanguage,
					body: writePortableText(
						body,
						selectedLanguageIsPending ? undefined : post.body,
					),
					baseRevisionId: post.latestRevisionId,
				},
			},
			{
				onSuccess: async () => {
					setDirty(false);
					await invalidatePostQueries(queryClient, rootPostId, post.id);
					await languagesChanged();
					router.push(postDetailHref("post", post.id));
				},
			},
		);
	}

	return (
		<form onChange={() => setDirty(true)} onSubmit={submit}>
			<FieldGroup>
				<PortableTextEditor
					label={t.posts.replyBody}
					onChange={(value) => {
						setBody(value);
						setDirty(true);
					}}
					required
					value={body}
				/>
				<RequestFailure error={update.error} />
				<Button
					className="w-fit"
					disabled={!body.length || update.isPending}
					type="submit"
					variant="solid"
				>
					{update.isPending ? <Spinner data-icon="inline-start" /> : null}
					{t.ui.save}
				</Button>
			</FieldGroup>
		</form>
	);
}
