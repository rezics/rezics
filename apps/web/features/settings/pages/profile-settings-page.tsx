"use client";

import { EntityPresentationEditor } from "@/features/participation/components/entity-presentation-editor";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { ContentLanguageValues, isContentLanguage, type ContentLanguage } from "@rezics/i18n";
import { useGetApiAccountMe } from "@rezics/openapi-tanstack-query";
import {
	NativeSelect,
	NativeSelectOption,
	PageHeading,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { useState } from "react";

export function ProfileSettings() {
	const { t } = useTranslation(["locale", "settings", "units"]);
	const preferred = useLocalizationLanguages();
	const [language, setLanguage] = useState<ContentLanguage>(preferred[0] ?? "en");
	const account = useGetApiAccountMe({ query: { localizationLanguages: [language] } });
	return (
		<section className="grid max-w-2xl gap-6">
			<PageHeading title={t.settings.profile} />
			<NativeSelect
				aria-label={t.units.contentLanguages.controlLabel}
				value={language}
				onChange={(event) => {
					if (isContentLanguage(event.currentTarget.value)) setLanguage(event.currentTarget.value);
				}}
			>
				{ContentLanguageValues.map((value) => (
					<NativeSelectOption key={value} value={value}>
						{t.locale.contentLanguages[value]}
					</NativeSelectOption>
				))}
			</NativeSelect>
			{account.isPending ? (
				<QueryPending />
			) : account.isError ? (
				<QueryFailure error={account.error} retry={() => void account.refetch()} />
			) : (
				<EntityPresentationEditor key={language} entity={account.data.entity} language={language} />
			)}
		</section>
	);
}
