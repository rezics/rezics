"use client";

import { Field, FieldDescription, FieldLabel, NativeSelect, NativeSelectOption } from "@rezics/ui";

import { useTranslation } from "@/i18n/client";

export type WikiAccessMode = "community_owned" | "restricted";

export function WikiAccessModeField({
	accessMode,
	onChange,
}: {
	readonly accessMode: WikiAccessMode;
	readonly onChange: (value: WikiAccessMode) => void;
}) {
	const { t } = useTranslation(["posts", "realms"]);
	return (
		<Field required>
			<FieldLabel>{t.posts.wikiAccessMode}</FieldLabel>
			<NativeSelect
				onChange={(event) =>
					onChange(
						event.currentTarget.value === "restricted"
							? "restricted"
							: "community_owned",
					)
				}
				value={accessMode}
			>
				<NativeSelectOption value="community_owned">
					{t.posts.wikiCommunityUnit}
				</NativeSelectOption>
				<NativeSelectOption value="restricted">{t.posts.wikiRestricted}</NativeSelectOption>
			</NativeSelect>
			<FieldDescription>
				{accessMode === "community_owned"
					? t.realms.contentComposer.communityEditableDescription
					: t.realms.contentComposer.restrictedDescription}
			</FieldDescription>
		</Field>
	);
}
