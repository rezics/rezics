"use client";

import {
	applyZoneAppearancePreset,
	type ZoneAppearanceDocument,
	ZoneAppearanceCardRadiusValues,
	ZoneAppearanceColorSchemeValues,
	ZoneAppearanceDensityValues,
	ZoneAppearanceHeadingFontScaleValues,
	type ZoneAppearancePresetId,
	ZoneAppearancePresetIdValues,
	ZoneAppearancePresetRegistry,
	ZoneAppearanceSurfaceTintValues,
	ZoneAppearanceTokenDefaults,
} from "@rezics/block";
import {
	Field,
	FieldGroup,
	FieldLabel,
	Input,
	NativeSelect,
	NativeSelectOption,
	RadioGroup,
	RadioGroupItem,
	RadioGroupLabel,
} from "@rezics/ui";

import {
	LocalizationImageUploadField,
	type LocalizationImageAssetValue,
} from "@/features/media/components/localization-image-upload-field";
import { useTranslation } from "@/i18n/client";

export interface ZoneThemeEditorValue {
	readonly theme: ZoneAppearanceDocument;
	readonly hero: LocalizationImageAssetValue | null;
}

interface ZoneThemeFieldsProps {
	readonly disabled?: boolean;
	readonly level1Enabled: boolean;
	readonly onChange: (value: ZoneThemeEditorValue) => void;
	readonly value: ZoneThemeEditorValue;
}

function effectivePresetId(theme: ZoneAppearanceDocument): ZoneAppearancePresetId | undefined {
	return ZoneAppearancePresetIdValues.find((presetId) => {
		const preset = ZoneAppearancePresetRegistry[presetId].tokens;
		return (
			theme.colorScheme === preset.colorScheme &&
			theme.accent.toLowerCase() === preset.accent &&
			theme.density === preset.density &&
			(theme.cardRadius ?? ZoneAppearanceTokenDefaults.cardRadius) === preset.cardRadius &&
			(theme.headingFontScale ?? ZoneAppearanceTokenDefaults.headingFontScale) ===
				preset.headingFontScale &&
			(theme.surfaceTint ?? ZoneAppearanceTokenDefaults.surfaceTint) === preset.surfaceTint &&
			theme.heroAssetId === ("heroAssetId" in preset ? preset.heroAssetId : undefined)
		);
	});
}

function withHeroAsset(
	theme: ZoneAppearanceDocument,
	hero: LocalizationImageAssetValue | null,
): ZoneAppearanceDocument {
	const next = { ...theme };
	if (hero) next.heroAssetId = hero.id;
	else delete next.heroAssetId;
	return next;
}

export function ZoneThemeFields({
	disabled = false,
	level1Enabled,
	onChange,
	value,
}: ZoneThemeFieldsProps) {
	const { t } = useTranslation(["zones"]);
	const copy = t.zones.theme;
	const selectedPresetId = effectivePresetId(value.theme);

	return (
		<div className="grid gap-8">
			<section className="grid gap-4" aria-labelledby="zone-theme-basics-title">
				<h2 className="font-semibold text-lg" id="zone-theme-basics-title">
					{copy.basicsTitle}
				</h2>
				<FieldGroup className="grid gap-4 sm:grid-cols-3">
					<Field>
						<FieldLabel>{copy.accent}</FieldLabel>
						<Input
							disabled={disabled}
							onChange={(event) =>
								onChange({
									...value,
									theme: { ...value.theme, accent: event.currentTarget.value },
								})
							}
							type="color"
							value={value.theme.accent}
						/>
					</Field>
					<Field>
						<FieldLabel>{copy.colorScheme}</FieldLabel>
						<NativeSelect
							disabled={disabled}
							onChange={(event) => {
								const colorScheme = ZoneAppearanceColorSchemeValues.find(
									(candidate) => candidate === event.currentTarget.value,
								);
								if (colorScheme) onChange({ ...value, theme: { ...value.theme, colorScheme } });
							}}
							value={value.theme.colorScheme}
						>
							{ZoneAppearanceColorSchemeValues.map((colorScheme) => (
								<NativeSelectOption key={colorScheme} value={colorScheme}>
									{copy.colorSchemes[colorScheme]}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
					<Field>
						<FieldLabel>{copy.density}</FieldLabel>
						<NativeSelect
							disabled={disabled}
							onChange={(event) => {
								const density = ZoneAppearanceDensityValues.find(
									(candidate) => candidate === event.currentTarget.value,
								);
								if (density) onChange({ ...value, theme: { ...value.theme, density } });
							}}
							value={value.theme.density}
						>
							{ZoneAppearanceDensityValues.map((density) => (
								<NativeSelectOption key={density} value={density}>
									{copy.densities[density]}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
				</FieldGroup>
			</section>

			{level1Enabled ? (
				<section className="grid gap-6" aria-labelledby="zone-theme-details-title">
					<h2 className="font-semibold text-lg" id="zone-theme-details-title">
						{copy.detailsTitle}
					</h2>
					<RadioGroup
						className="grid gap-3"
						disabled={disabled}
						onValueChange={({ value: presetId }) => {
							const nextPresetId = ZoneAppearancePresetIdValues.find(
								(candidate) => candidate === presetId,
							);
							if (!nextPresetId) return;
							onChange({
								theme: applyZoneAppearancePreset(value.theme, nextPresetId),
								hero: null,
							});
						}}
						value={selectedPresetId ?? ""}
					>
						<RadioGroupLabel>{copy.gallery.title}</RadioGroupLabel>
						<p className="text-muted-foreground text-sm">{copy.gallery.consequence}</p>
						<div className="grid gap-3 md:grid-cols-3">
							{ZoneAppearancePresetIdValues.map((presetId) => {
								const preset = ZoneAppearancePresetRegistry[presetId];
								const presetCopy = copy.gallery.options[presetId];
								return (
									<RadioGroupItem
										className="min-w-0 items-start rounded-xl border border-input p-4 transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary/8"
										key={preset.id}
										value={preset.id}
									>
										<span className="grid min-w-0 flex-1 gap-3">
											<span
												aria-hidden
												className="h-10 w-full rounded-lg border border-black/10"
												style={{ backgroundColor: preset.tokens.accent }}
											/>
											<span className="grid gap-1">
												<span className="font-semibold">{presetCopy.label}</span>
												<span className="font-normal text-muted-foreground text-sm leading-5">
													{presetCopy.description}
												</span>
											</span>
										</span>
									</RadioGroupItem>
								);
							})}
						</div>
					</RadioGroup>

					<FieldGroup className="grid gap-4 sm:grid-cols-3">
						<Field className="sm:col-span-3">
							<FieldLabel>{copy.hero}</FieldLabel>
							<LocalizationImageUploadField
								onChange={(hero) => onChange({ hero, theme: withHeroAsset(value.theme, hero) })}
								role="banner"
								value={value.hero}
							/>
						</Field>
						<Field>
							<FieldLabel>{copy.cardRadius}</FieldLabel>
							<NativeSelect
								disabled={disabled}
								onChange={(event) => {
									const cardRadius = ZoneAppearanceCardRadiusValues.find(
										(candidate) => candidate === event.currentTarget.value,
									);
									if (cardRadius) onChange({ ...value, theme: { ...value.theme, cardRadius } });
								}}
								value={value.theme.cardRadius ?? ZoneAppearanceTokenDefaults.cardRadius}
							>
								{ZoneAppearanceCardRadiusValues.map((cardRadius) => (
									<NativeSelectOption key={cardRadius} value={cardRadius}>
										{copy.cardRadii[cardRadius]}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
						<Field>
							<FieldLabel>{copy.headingFontScale}</FieldLabel>
							<NativeSelect
								disabled={disabled}
								onChange={(event) => {
									const headingFontScale = ZoneAppearanceHeadingFontScaleValues.find(
										(candidate) => candidate === event.currentTarget.value,
									);
									if (headingFontScale)
										onChange({ ...value, theme: { ...value.theme, headingFontScale } });
								}}
								value={value.theme.headingFontScale ?? ZoneAppearanceTokenDefaults.headingFontScale}
							>
								{ZoneAppearanceHeadingFontScaleValues.map((headingFontScale) => (
									<NativeSelectOption key={headingFontScale} value={headingFontScale}>
										{copy.headingFontScales[headingFontScale]}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
						<Field>
							<FieldLabel>{copy.surfaceTint}</FieldLabel>
							<NativeSelect
								disabled={disabled}
								onChange={(event) => {
									const surfaceTint = ZoneAppearanceSurfaceTintValues.find(
										(candidate) => candidate === event.currentTarget.value,
									);
									if (surfaceTint) onChange({ ...value, theme: { ...value.theme, surfaceTint } });
								}}
								value={value.theme.surfaceTint ?? ZoneAppearanceTokenDefaults.surfaceTint}
							>
								{ZoneAppearanceSurfaceTintValues.map((surfaceTint) => (
									<NativeSelectOption key={surfaceTint} value={surfaceTint}>
										{copy.surfaceTints[surfaceTint]}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
					</FieldGroup>
				</section>
			) : null}
		</div>
	);
}
