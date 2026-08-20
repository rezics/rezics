"use client";

import { Field, FieldDescription, FieldLabel, UnitMultiPicker } from "@rezics/ui";

import { useTranslation } from "@/i18n/client";
import {
	AdaptedAudioUnitKinds,
	MaximumAdaptedAudioRelationsPerVideo,
} from "../model/adapted-audio";

export function AdaptedAudioField({
	onChange,
	value,
}: {
	readonly onChange: (value: readonly string[]) => void;
	readonly value: readonly string[];
}) {
	const { t } = useTranslation(["ui", "units"]);
	return (
		<Field>
			<FieldLabel>{t.units.fields.adaptedAudio}</FieldLabel>
			<UnitMultiPicker
				ariaLabel={t.units.fields.adaptedAudio}
				kinds={AdaptedAudioUnitKinds}
				maxValues={MaximumAdaptedAudioRelationsPerVideo}
				onValuesChange={onChange}
				placeholder={t.ui.pickerPlaceholders.unit}
				removeLabel={t.units.fields.removeAdaptedAudio}
				values={value}
			/>
			<FieldDescription>{t.units.fields.adaptedAudioDescription}</FieldDescription>
		</Field>
	);
}
