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
import { type FormEvent } from "react";

import {
	PortableTextEditor,
	spoilerPortableTextEditorCapabilities,
} from "@/features/editor/portable-text-editor";
import { ContentLanguageControl } from "@/features/content-languages/components/content-language-control";
import { LocalizedDraftGate } from "@/features/content-languages/components/localized-draft-gate";
import {
	useContentLanguageEditor,
	useLocalizedDraft,
	type LocalizedDraftCodec,
} from "@/features/content-languages/hooks/use-content-language-editor";
import {
	decodeDraftPortableText,
	decodeDraftString,
	isDraftRecord,
} from "@/features/content-languages/model/localized-draft-codec";
import { ReviewEditPage } from "@/features/reviews/pages/review-edit-page";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { readPortableText, writePortableText } from "@/lib/block";
import { PostEditorFields } from "../components/post-editor-fields";
import { PostManagementSectionHeader } from "../components/post-management-section-header";
import { usePostManagement } from "../components/post-management-workspace";
import { nullablePostLocalizationText } from "../model/post-localization-input";
import { invalidatePostQueries } from "../query";
import { postDetailHref } from "../routing/post-management-routes";

type RootPostContent = Exclude<GetApiPostsByPostIdStatus200, { postKind: "review" | "reply" }>;
type ReplyPost = Extract<GetApiPostsByPostIdStatus200, { postKind: "reply" }>;
type PostLocalizationDraft = { title: string; summary: string; body: PortableTextValue };
type ReplyLocalizationDraft = { body: PortableTextValue };
const PostLocalizationDraftCodec: LocalizedDraftCodec<PostLocalizationDraft> = {
	version: 1,
	decode(value) {
		if (!isDraftRecord(value)) return;
		const title = decodeDraftString(value.title);
		const summary = decodeDraftString(value.summary);
		const body = decodeDraftPortableText(value.body);
		return title === undefined || summary === undefined || !body
			? undefined
			: { title, summary, body };
	},
};
const ReplyLocalizationDraftCodec: LocalizedDraftCodec<ReplyLocalizationDraft> = {
	version: 1,
	decode(value) {
		if (!isDraftRecord(value)) return;
		const body = decodeDraftPortableText(value.body);
		return body ? { body } : undefined;
	},
};

export function PostEditPage() {
	const { resource } = usePostManagement();
	if (resource.item.postKind === "review") return <ReviewEditPage />;
	return <PostContentEditPage post={resource.item} />;
}

function PostContentEditPage({
	post,
}: {
	post: Exclude<GetApiPostsByPostIdStatus200, { postKind: "review" }>;
}) {
	const { t } = useTranslation(["errors", "posts"]);
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
					<PostContentEditForm key={`${post.id}:${selectedLanguage}`} post={post} />
				)}
			</div>
		</section>
	);
}

function PostContentEditForm({ post }: { post: RootPostContent }) {
	const { t } = useTranslation(["posts", "ui"]);
	const router = useApplicationRouter();
	const queryClient = useQueryClient();
	const update = usePatchApiPostsByPostId();
	const { selectedLanguage, selectedLanguageIsPending, languagesChanged } =
		useContentLanguageEditor();
	const draft = useLocalizedDraft<PostLocalizationDraft>({
		scope: "post-localization",
		baseVersion: post.latestRevisionId,
		codec: PostLocalizationDraftCodec,
		createInitialValue: () => ({
			title: selectedLanguageIsPending ? "" : (post.title ?? ""),
			summary: selectedLanguageIsPending ? "" : (post.summary ?? ""),
			body: readPortableText(selectedLanguageIsPending ? null : post.body),
		}),
	});
	const { value } = draft;

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		if (!value.body.length || !post.latestRevisionId) return;
		update.mutate(
			{
				path: { postId: post.id },
				body: {
					language: selectedLanguage,
					title: nullablePostLocalizationText(form, "title"),
					summary: nullablePostLocalizationText(form, "summary"),
					body: writePortableText(value.body, selectedLanguageIsPending ? undefined : post.body),
					baseRevisionId: post.latestRevisionId,
				},
			},
			{
				onSuccess: async () => {
					draft.commit();
					await invalidatePostQueries(queryClient, post.id);
					await languagesChanged();
					router.push(postDetailHref(post.id));
				},
			},
		);
	}

	return (
		<LocalizedDraftGate
			hydrated={draft.hydrated}
			onDiscard={draft.discard}
			serverChanged={draft.serverChanged}
		>
			<form onSubmit={submit}>
				<FieldGroup>
					<Field>
						<FieldLabel>{t.posts.titleOptional}</FieldLabel>
						<Input
							maxLength={500}
							name="title"
							onChange={(event) => {
								const title = event.currentTarget.value;
								draft.setValue((current) => ({ ...current, title }));
							}}
							value={value.title}
						/>
					</Field>
					<Field>
						<FieldLabel>{t.posts.summaryOptional}</FieldLabel>
						<Textarea
							maxLength={2_000}
							name="summary"
							onChange={(event) => {
								const summary = event.currentTarget.value;
								draft.setValue((current) => ({ ...current, summary }));
							}}
							value={value.summary}
						/>
					</Field>
					<PostEditorFields
						body={value.body}
						error={update.error}
						onBodyChange={(body) => draft.setValue((current) => ({ ...current, body }))}
						pending={update.isPending}
						submitLabel={t.ui.save}
					/>
				</FieldGroup>
			</form>
		</LocalizedDraftGate>
	);
}

function ReplyPostEditForm({ post }: { post: ReplyPost }) {
	const { t } = useTranslation(["posts", "ui"]);
	const router = useApplicationRouter();
	const queryClient = useQueryClient();
	const update = usePatchApiPostsByPostIdRepliesByReplyPostId();
	const { selectedLanguage, selectedLanguageIsPending, languagesChanged } =
		useContentLanguageEditor();
	const draft = useLocalizedDraft<ReplyLocalizationDraft>({
		scope: "reply-localization",
		baseVersion: post.latestRevisionId,
		codec: ReplyLocalizationDraftCodec,
		createInitialValue: () => ({
			body: readPortableText(selectedLanguageIsPending ? null : post.body),
		}),
	});
	const { value } = draft;
	const rootPostId = post.rootPostId;

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!rootPostId || !post.latestRevisionId || !value.body.length) return;
		update.mutate(
			{
				path: { postId: rootPostId, replyPostId: post.id },
				body: {
					language: selectedLanguage,
					body: writePortableText(value.body, selectedLanguageIsPending ? undefined : post.body),
					baseRevisionId: post.latestRevisionId,
				},
			},
			{
				onSuccess: async () => {
					draft.commit();
					await invalidatePostQueries(queryClient, rootPostId, post.id);
					await languagesChanged();
					router.push(postDetailHref(post.id));
				},
			},
		);
	}

	return (
		<LocalizedDraftGate
			hydrated={draft.hydrated}
			onDiscard={draft.discard}
			serverChanged={draft.serverChanged}
		>
			<form onSubmit={submit}>
				<FieldGroup>
					<PortableTextEditor
						capabilities={spoilerPortableTextEditorCapabilities}
						label={t.posts.replyBody}
						onChange={(body) => draft.setValue((current) => ({ ...current, body }))}
						required
						value={value.body}
					/>
					<RequestFailure error={update.error} />
					<Button
						className="w-fit"
						disabled={!value.body.length || update.isPending}
						type="submit"
						variant="solid"
					>
						{update.isPending ? <Spinner data-icon="inline-start" /> : null}
						{t.ui.save}
					</Button>
				</FieldGroup>
			</form>
		</LocalizedDraftGate>
	);
}
