"use client";

import {
	applyZoneThemePreset,
	type ZoneThemeDocument,
	ZoneThemeCardRadiusValues,
	ZoneThemeColorSchemeValues,
	ZoneThemeDensityValues,
	ZoneThemeHeadingFontScaleValues,
	type ZoneThemePresetId,
	ZoneThemePresetIdValues,
	ZoneThemePresetRegistry,
	ZoneThemeSurfaceTintValues,
	ZoneThemeTokenDefaults,
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
	readonly theme: ZoneThemeDocument;
	readonly hero: LocalizationImageAssetValue | null;
}

interface ZoneThemeFieldsProps {
	readonly disabled?: boolean;
	readonly level1Enabled: boolean;
	readonly onChange: (value: ZoneThemeEditorValue) => void;
	readonly value: ZoneThemeEditorValue;
}

function effectivePresetId(theme: ZoneThemeDocument): ZoneThemePresetId | undefined {
	return ZoneThemePresetIdValues.find((presetId) => {
		const preset = ZoneThemePresetRegistry[presetId].tokens;
		return (
			theme.colorScheme === preset.colorScheme &&
			theme.accent.toLowerCase() === preset.accent &&
			theme.density === preset.density &&
			(theme.cardRadius ?? ZoneThemeTokenDefaults.cardRadius) === preset.cardRadius &&
			(theme.headingFontScale ?? ZoneThemeTokenDefaults.headingFontScale) ===
				preset.headingFontScale &&
			(theme.surfaceTint ?? ZoneThemeTokenDefaults.surfaceTint) === preset.surfaceTint &&
			theme.heroAssetId === ("heroAssetId" in preset ? preset.heroAssetId : undefined)
		);
	});
}

function withHeroAsset(
	theme: ZoneThemeDocument,
	hero: LocalizationImageAssetValue | null,
): ZoneThemeDocument {
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
								const colorScheme = ZoneThemeColorSchemeValues.find(
									(candidate) => candidate === event.currentTarget.value,
								);
								if (colorScheme) onChange({ ...value, theme: { ...value.theme, colorScheme } });
							}}
							value={value.theme.colorScheme}
						>
							{ZoneThemeColorSchemeValues.map((colorScheme) => (
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
								const density = ZoneThemeDensityValues.find(
									(candidate) => candidate === event.currentTarget.value,
								);
								if (density) onChange({ ...value, theme: { ...value.theme, density } });
							}}
							value={value.theme.density}
						>
							{ZoneThemeDensityValues.map((density) => (
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
							const nextPresetId = ZoneThemePresetIdValues.find(
								(candidate) => candidate === presetId,
							);
							if (!nextPresetId) return;
							onChange({
								theme: applyZoneThemePreset(value.theme, nextPresetId),
								hero: null,
							});
						}}
						value={selectedPresetId ?? ""}
					>
						<RadioGroupLabel>{copy.gallery.title}</RadioGroupLabel>
						<p className="text-muted-foreground text-sm">{copy.gallery.consequence}</p>
						<div className="grid gap-3 md:grid-cols-3">
							{ZoneThemePresetIdValues.map((presetId) => {
								const preset = ZoneThemePresetRegistry[presetId];
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
									const cardRadius = ZoneThemeCardRadiusValues.find(
										(candidate) => candidate === event.currentTarget.value,
									);
									if (cardRadius) onChange({ ...value, theme: { ...value.theme, cardRadius } });
								}}
								value={value.theme.cardRadius ?? ZoneThemeTokenDefaults.cardRadius}
							>
								{ZoneThemeCardRadiusValues.map((cardRadius) => (
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
									const headingFontScale = ZoneThemeHeadingFontScaleValues.find(
										(candidate) => candidate === event.currentTarget.value,
									);
									if (headingFontScale)
										onChange({ ...value, theme: { ...value.theme, headingFontScale } });
								}}
								value={value.theme.headingFontScale ?? ZoneThemeTokenDefaults.headingFontScale}
							>
								{ZoneThemeHeadingFontScaleValues.map((headingFontScale) => (
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
									const surfaceTint = ZoneThemeSurfaceTintValues.find(
										(candidate) => candidate === event.currentTarget.value,
									);
									if (surfaceTint) onChange({ ...value, theme: { ...value.theme, surfaceTint } });
								}}
								value={value.theme.surfaceTint ?? ZoneThemeTokenDefaults.surfaceTint}
							>
								{ZoneThemeSurfaceTintValues.map((surfaceTint) => (
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
