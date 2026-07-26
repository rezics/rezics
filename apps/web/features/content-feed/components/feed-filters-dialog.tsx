"use client";

import type { ContentLanguage } from "@rezics/i18n";
import {
	Button,
	ChoiceSelect,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	Field,
	FieldLabel,
	type ChoiceOption,
} from "@rezics/ui";
import { useState } from "react";

import { useTranslation } from "@/i18n/client";

export function FeedFiltersDialog({
	languageOptions,
	languages,
	onClose,
	onLanguagesChange,
	onRealmIdsChange,
	onTagIdsChange,
	realmIds,
	realmOptions,
	tagIds,
	tagOptions,
}: {
	languageOptions: readonly ChoiceOption<ContentLanguage>[];
	languages: readonly ContentLanguage[];
	onClose: () => void;
	onLanguagesChange?: (languages: readonly ContentLanguage[]) => void;
	onRealmIdsChange?: (realmIds: readonly string[]) => void;
	onTagIdsChange?: (tagIds: readonly string[]) => void;
	realmIds: readonly string[];
	realmOptions: readonly ChoiceOption<string>[];
	tagIds: readonly string[];
	tagOptions: readonly ChoiceOption<string>[];
}) {
	const { t } = useTranslation(["feed"]);
	const [draftLanguages, setDraftLanguages] = useState(onLanguagesChange ? languages : []);
	const [draftRealmIds, setDraftRealmIds] = useState(onRealmIdsChange ? realmIds : []);
	const [draftTagIds, setDraftTagIds] = useState(onTagIdsChange ? tagIds : []);
	const hasDraftFilters =
		draftLanguages.length > 0 || draftRealmIds.length > 0 || draftTagIds.length > 0;

	const clear = () => {
		setDraftLanguages([]);
		setDraftRealmIds([]);
		setDraftTagIds([]);
	};
	const apply = () => {
		onLanguagesChange?.(draftLanguages);
		onRealmIdsChange?.(draftRealmIds);
		onTagIdsChange?.(draftTagIds);
		onClose();
	};

	return (
		<Dialog
			onOpenChange={({ open }) => {
				if (!open) onClose();
			}}
			open
		>
			<DialogContent showCloseButton={false} size="sm">
				<DialogHeader title={t.feed.filters.title} />
				<DialogBody className="grid gap-5">
					<Button
						className="w-fit"
						disabled={!hasDraftFilters}
						onClick={clear}
						type="button"
						variant="quiet"
					>
						{t.feed.filters.clear}
					</Button>

					{onLanguagesChange ? (
						<Field>
							<FieldLabel>{t.feed.filters.languages.label}</FieldLabel>
							<ChoiceSelect
								appearance="field"
								ariaLabel={t.feed.filters.languages.label}
								multiple
								onValueChange={setDraftLanguages}
								options={languageOptions}
								placeholder={t.feed.filters.languages.all}
								value={draftLanguages}
							/>
						</Field>
					) : null}

					{onRealmIdsChange ? (
						<Field>
							<FieldLabel>{t.feed.filters.realms.label}</FieldLabel>
							<ChoiceSelect
								appearance="field"
								ariaLabel={t.feed.filters.realms.label}
								multiple
								onValueChange={setDraftRealmIds}
								options={realmOptions}
								placeholder={t.feed.filters.realms.all}
								value={draftRealmIds}
							/>
						</Field>
					) : null}

					{onTagIdsChange ? (
						<Field>
							<FieldLabel>{t.feed.filters.tags.label}</FieldLabel>
							<ChoiceSelect
								appearance="field"
								ariaLabel={t.feed.filters.tags.label}
								multiple
								onValueChange={setDraftTagIds}
								options={tagOptions}
								placeholder={t.feed.filters.tags.all}
								value={draftTagIds}
							/>
						</Field>
					) : null}
				</DialogBody>
				<DialogFooter>
					<Button onClick={onClose} type="button" variant="outline">
						{t.feed.filters.cancel}
					</Button>
					<Button onClick={apply} type="button" variant="solid">
						{t.feed.filters.apply}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
