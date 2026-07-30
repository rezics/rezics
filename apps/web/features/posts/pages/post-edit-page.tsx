"use client";

import {
	usePatchApiPostsByPostId,
	usePatchApiPostsByPostIdRepliesByReplyPostId,
	type GetApiPostsByPostIdStatus200,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import { Button, Field, FieldGroup, FieldLabel, Input, Spinner, Textarea } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { useState, type FormEvent } from "react";

import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import { ContentLanguageControl } from "@/features/content-languages/components/content-language-control";
import { useContentLanguageEditor } from "@/features/content-languages/hooks/use-content-language-editor";
import { ReviewEditPage } from "@/features/reviews/pages/review-edit-page";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { readPortableText, writePortableText } from "@/lib/block";
import { PostEditorFields } from "../components/post-editor-fields";
import { PostManagementSectionHeader } from "../components/post-management-section-header";
import {
	useOrdinaryPostManagement,
	usePostManagement,
} from "../components/post-management-workspace";
import { nullablePostLocalizationText } from "../model/post-localization-input";
import { invalidatePostQueries } from "../query";
import { postDetailHref } from "../routing/post-management-routes";

type OrdinaryPost = Extract<GetApiPostsByPostIdStatus200, { postKind: "post" | "excerpt" }>;
type ReplyPost = Extract<GetApiPostsByPostIdStatus200, { postKind: "reply" }>;

export function PostEditPage() {
	const { resource } = usePostManagement();
	if (resource.item.postKind === "review") return <ReviewEditPage />;
	return <OrdinaryPostEditPage />;
}

function OrdinaryPostEditPage() {
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
			<div className="grid gap-6">
				<ContentLanguageControl />
				{post.postKind === "reply" ? (
					<ReplyPostEditForm key={`${post.id}:${selectedLanguage}`} post={post} />
				) : (
					<OrdinaryPostEditForm key={`${post.id}:${selectedLanguage}`} post={post} />
				)}
			</div>
		</section>
	);
}

function OrdinaryPostEditForm({ post }: { post: OrdinaryPost }) {
	const { t } = useTranslation(["posts", "ui"]);
	const router = useApplicationRouter();
	const queryClient = useQueryClient();
	const update = usePatchApiPostsByPostId();
	const { selectedLanguage, selectedLanguageIsPending, setDirty, languagesChanged } =
		useContentLanguageEditor();
	const [body, setBody] = useState<PortableTextValue>(() =>
		readPortableText(selectedLanguageIsPending ? null : post.body),
	);

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		if (!body.length || !post.latestRevisionId) return;
		update.mutate(
			{
				path: { postId: post.id },
				body: {
					language: selectedLanguage,
					title: nullablePostLocalizationText(form, "title"),
					summary: nullablePostLocalizationText(form, "summary"),
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
					router.push(postDetailHref(post.id));
				},
			},
		);
	}

	return (
		<form onChange={() => setDirty(true)} onSubmit={submit}>
			<FieldGroup>
				<Field>
					<FieldLabel>{t.posts.titleOptional}</FieldLabel>
					<Input
						defaultValue={selectedLanguageIsPending ? "" : (post.title ?? "")}
						maxLength={500}
						name="title"
					/>
				</Field>
				<Field>
					<FieldLabel>{t.posts.summaryOptional}</FieldLabel>
					<Textarea
						defaultValue={selectedLanguageIsPending ? "" : (post.summary ?? "")}
						maxLength={2_000}
						name="summary"
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

function ReplyPostEditForm({ post }: { post: ReplyPost }) {
	const { t } = useTranslation(["posts", "ui"]);
	const router = useApplicationRouter();
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
					router.push(postDetailHref(post.id));
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
