"use client";

import { ChoiceSelect, Field, FieldGroup, FieldLabel, Input, Textarea } from "@rezics/ui";
import { useState } from "react";

import {
	LocalizationImageUploadField,
	type LocalizationImageAssetValue,
} from "@/features/media/components/localization-image-upload-field";
import { useTranslation } from "@/i18n/client";

export function CollectionLocalizationFields({
	cover,
	initial,
	onCoverChange,
}: {
	readonly cover: LocalizationImageAssetValue | null;
	readonly initial?: {
		readonly title?: string | null;
		readonly summary?: string | null;
	};
	readonly onCoverChange: (value: LocalizationImageAssetValue | null) => void;
}) {
	const { t } = useTranslation(["collections"]);
	return (
		<FieldGroup>
			<Field>
				<FieldLabel>{t.collections.form.cover}</FieldLabel>
				<LocalizationImageUploadField onChange={onCoverChange} role="cover" value={cover} />
			</Field>
			<Field required>
				<FieldLabel>{t.collections.form.title}</FieldLabel>
				<Input defaultValue={initial?.title ?? ""} maxLength={500} name="title" required />
			</Field>
			<Field>
				<FieldLabel>{t.collections.form.summary}</FieldLabel>
				<Textarea defaultValue={initial?.summary ?? ""} maxLength={2_000} name="summary" />
			</Field>
		</FieldGroup>
	);
}

export const CollectionStatuses = ["draft", "published", "archived"] as const;
export const CollectionVisibilities = ["public", "unlisted", "private"] as const;

export type CollectionStatus = (typeof CollectionStatuses)[number];
export type CollectionVisibility = (typeof CollectionVisibilities)[number];

export function parseCollectionStatus(value: FormDataEntryValue | null): CollectionStatus {
	return CollectionStatuses.find((status) => status === value) ?? "draft";
}

export function parseCollectionVisibility(value: FormDataEntryValue | null): CollectionVisibility {
	return CollectionVisibilities.find((visibility) => visibility === value) ?? "private";
}

export function CollectionLifecycleFields({
	status,
	visibility,
}: {
	readonly status: CollectionStatus;
	readonly visibility: CollectionVisibility;
}) {
	const { t } = useTranslation(["collections", "ui"]);
	const [selectedStatus, setSelectedStatus] = useState(status);
	const [selectedVisibility, setSelectedVisibility] = useState(visibility);
	return (
		<FieldGroup>
			<Field>
				<FieldLabel>{t.collections.form.status}</FieldLabel>
				<ChoiceSelect
					appearance="field"
					ariaLabel={t.collections.form.status}
					className="w-full"
					name="status"
					onValueChange={([value]) => {
						if (value) setSelectedStatus(value);
					}}
					options={[
						{ value: "draft", label: t.ui.draft },
						{ value: "published", label: t.ui.published },
						{ value: "archived", label: t.ui.archived },
					]}
					placeholder={t.collections.form.status}
					value={[selectedStatus]}
				/>
			</Field>
			<Field>
				<FieldLabel>{t.collections.form.visibility}</FieldLabel>
				<ChoiceSelect
					appearance="field"
					ariaLabel={t.collections.form.visibility}
					className="w-full"
					name="visibility"
					onValueChange={([value]) => {
						if (value) setSelectedVisibility(value);
					}}
					options={[
						{ value: "public", label: t.ui.public },
						{ value: "unlisted", label: t.ui.unlisted },
						{ value: "private", label: t.ui.private },
					]}
					placeholder={t.collections.form.visibility}
					value={[selectedVisibility]}
				/>
			</Field>
		</FieldGroup>
	);
}
