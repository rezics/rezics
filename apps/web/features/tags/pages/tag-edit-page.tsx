"use client";

import { usePutApiTagsByTagIdLocalizationsByLanguage } from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import {
	Button,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
	ManagementWorkspaceSectionHeader,
	Textarea,
} from "@rezics/ui";
import { type FormEvent, useState } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { ContentLanguageControl } from "@/features/content-languages/components/content-language-control";
import { useContentLanguageEditor } from "@/features/content-languages/hooks/use-content-language-editor";
import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { readPortableText, writePortableText } from "@/lib/block";
import { useTagManagement } from "../components/tag-management-workspace";
import { tagManagementHref } from "../routing/tag-links";

export function TagEditPage() {
	const { tag } = useTagManagement();
	const { selectedLanguage } = useContentLanguageEditor();
	const localization = tag.localizations.find((entry) => entry.language === selectedLanguage);
	return (
		<section>
			<TagEditSectionHeader />
			<div className="grid gap-6">
				<div className="flex flex-wrap items-center gap-4 rounded-2xl bg-card p-4 sm:p-5">
					<div className="ms-auto shrink-0">
						<ContentLanguageControl />
					</div>
				</div>
				<TagLocalizationForm
					key={`${tag.id}:${selectedLanguage}:${localization?.updatedAt ?? "new"}`}
					localization={localization}
					tagId={tag.id}
				/>
			</div>
		</section>
	);
}

function TagEditSectionHeader() {
	const { tag } = useTagManagement();
	const { t } = useTranslation(["tags"]);
	return (
		<ManagementWorkspaceSectionHeader
			backHref={tagManagementHref(tag.id)}
			backLabel={t.tags.detail.backToEditOverview}
			description={t.tags.detail.editDescription}
			link={Link}
			title={t.tags.detail.editTitle}
		/>
	);
}

function TagLocalizationForm({
	localization,
	tagId,
}: {
	readonly localization:
		ReturnType<typeof useTagManagement>["tag"]["localizations"][number] | undefined;
	readonly tagId: string;
}) {
	const { t } = useTranslation(["ui"]);
	const { dirty, languagesChanged, selectedLanguage, setDirty } = useContentLanguageEditor();
	const update = usePutApiTagsByTagIdLocalizationsByLanguage();
	const [title, setTitle] = useState(localization?.title ?? "");
	const [summary, setSummary] = useState(localization?.summary ?? "");
	const [body, setBody] = useState<PortableTextValue>(() =>
		readPortableText(localization?.description),
	);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!title.trim() || update.isPending) return;
		try {
			await update.mutateAsync({
				path: { tagId, language: selectedLanguage },
				body: {
					title: title.trim(),
					summary: summary.trim(),
					description: writePortableText(body, localization?.description),
				},
			});
			setDirty(false);
			await languagesChanged();
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<form className="max-w-2xl" onSubmit={(event) => void submit(event)}>
			<FieldGroup>
				<Field required>
					<FieldLabel>{t.ui.title}</FieldLabel>
					<Input
						maxLength={500}
						onChange={(event) => {
							setTitle(event.currentTarget.value);
							setDirty(true);
						}}
						required
						value={title}
					/>
				</Field>
				<Field>
					<FieldLabel>{t.ui.summary}</FieldLabel>
					<Textarea
						maxLength={2000}
						onChange={(event) => {
							setSummary(event.currentTarget.value);
							setDirty(true);
						}}
						value={summary}
					/>
				</Field>
				<PortableTextEditor
					label={t.ui.body}
					onChange={(value) => {
						setBody(value);
						setDirty(true);
					}}
					value={body}
				/>
				<RequestFailure error={update.error} fallback={t.ui.retryLater} />
				<Button
					className="w-fit"
					disabled={!dirty || !title.trim()}
					isLoading={update.isPending}
					type="submit"
					variant="solid"
				>
					{t.ui.save}
				</Button>
			</FieldGroup>
		</form>
	);
}
