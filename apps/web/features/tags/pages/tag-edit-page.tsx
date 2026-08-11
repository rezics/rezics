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
import { type FormEvent } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
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
import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { readPortableText, writePortableText } from "@/lib/block";
import { useTagManagement } from "../components/tag-management-workspace";
import { tagManagementHref } from "../routing/tag-links";

type TagLocalizationDraft = { title: string; summary: string; body: PortableTextValue };
const TagLocalizationDraftCodec: LocalizedDraftCodec<TagLocalizationDraft> = {
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
		| ReturnType<typeof useTagManagement>["tag"]["localizations"][number]
		| undefined;
	readonly tagId: string;
}) {
	const { t } = useTranslation(["ui"]);
	const { languagesChanged, selectedLanguage } = useContentLanguageEditor();
	const update = usePutApiTagsByTagIdLocalizationsByLanguage();
	const draft = useLocalizedDraft<TagLocalizationDraft>({
		scope: "tag-localization",
		baseVersion: localization?.updatedAt ?? null,
		codec: TagLocalizationDraftCodec,
		createInitialValue: () => ({
			title: localization?.title ?? "",
			summary: localization?.summary ?? "",
			body: readPortableText(localization?.description),
		}),
	});
	const { value } = draft;

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!value.title.trim() || update.isPending) return;
		try {
			await update.mutateAsync({
				path: { tagId, language: selectedLanguage },
				body: {
					title: value.title.trim(),
					summary: value.summary.trim(),
					description: writePortableText(value.body, localization?.description),
				},
			});
			draft.commit();
			await languagesChanged();
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<LocalizedDraftGate
			hydrated={draft.hydrated}
			onDiscard={draft.discard}
			serverChanged={draft.serverChanged}
		>
			<form className="max-w-2xl" onSubmit={(event) => void submit(event)}>
				<FieldGroup>
					<Field required>
						<FieldLabel>{t.ui.title}</FieldLabel>
						<Input
							maxLength={500}
							onChange={(event) => {
								const title = event.currentTarget.value;
								draft.setValue((current) => ({ ...current, title }));
							}}
							required
							value={value.title}
						/>
					</Field>
					<Field>
						<FieldLabel>{t.ui.summary}</FieldLabel>
						<Textarea
							maxLength={2000}
							onChange={(event) => {
								const summary = event.currentTarget.value;
								draft.setValue((current) => ({ ...current, summary }));
							}}
							value={value.summary}
						/>
					</Field>
					<PortableTextEditor
						label={t.ui.body}
						onChange={(body) => draft.setValue((current) => ({ ...current, body }))}
						value={value.body}
					/>
					<RequestFailure error={update.error} fallback={t.ui.retryLater} />
					<Button
						className="w-fit"
						disabled={!draft.dirty || !value.title.trim()}
						isLoading={update.isPending}
						type="submit"
						variant="solid"
					>
						{t.ui.save}
					</Button>
				</FieldGroup>
			</form>
		</LocalizedDraftGate>
	);
}
