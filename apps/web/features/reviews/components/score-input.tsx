"use client";

import { Field, FieldDescription, FieldLabel, NativeSelect, NativeSelectOption } from "@rezics/ui";

import { useTranslation } from "@/i18n/client";

export function ScoreInput({
	disabled = false,
	onChange,
	value,
}: {
	disabled?: boolean;
	onChange: (value: number | undefined) => void;
	value: number | undefined;
}) {
	const { t } = useTranslation(["engagement"]);
	return (
		<Field>
			<FieldLabel>{t.engagement.reviewScoreOptional}</FieldLabel>
			<NativeSelect
				disabled={disabled}
				onChange={(event) => {
					const next = Number(event.currentTarget.value);
					onChange(Number.isInteger(next) && next >= 1 && next <= 10 ? next : undefined);
				}}
				value={value === undefined ? "" : String(value)}
			>
				<NativeSelectOption value="">{t.engagement.reviewWithoutScore}</NativeSelectOption>
				{Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
					<NativeSelectOption key={score} value={score}>
						{t.engagement.scoreOutOfTen({ score: String(score) })}
					</NativeSelectOption>
				))}
			</NativeSelect>
			<FieldDescription>{t.engagement.reviewScoreContextHint}</FieldDescription>
		</Field>
	);
}
