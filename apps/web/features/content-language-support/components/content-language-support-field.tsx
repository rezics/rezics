"use client";

import {
	ContentLanguageChannelValues,
	type ContentLanguageChannel,
} from "@rezics/content-language";
import { Badge, Button, Checkbox, Field, FieldLabel, Input } from "@rezics/ui";
import { useId, useState } from "react";

import { useTranslation } from "@/i18n/client";
import {
	addContentLanguage,
	removeContentLanguage,
	toggleContentLanguageChannel,
	type ContentLanguageSupportDraft,
} from "../model/content-language-support";

export type ContentLanguageSupportFieldProps = {
	readonly disabled?: boolean;
	readonly onChange: (value: ContentLanguageSupportDraft) => void;
	readonly value: ContentLanguageSupportDraft;
};

export function ContentLanguageSupportField({
	disabled = false,
	onChange,
	value,
}: ContentLanguageSupportFieldProps) {
	const { t } = useTranslation(["units"]);
	const fieldId = useId();
	const [languageTagInput, setLanguageTagInput] = useState("");
	const [languageTagInvalid, setLanguageTagInvalid] = useState(false);

	function addLanguage() {
		const candidate = languageTagInput.trim();
		if (!candidate) {
			setLanguageTagInvalid(true);
			return;
		}
		try {
			onChange(addContentLanguage(value, candidate));
			setLanguageTagInput("");
			setLanguageTagInvalid(false);
		} catch {
			setLanguageTagInvalid(true);
		}
	}

	return (
		<section aria-labelledby={`${fieldId}-title`} className="grid gap-4 rounded-xl border p-4">
			<div className="grid gap-1">
				<h3 className="font-heading font-bold" id={`${fieldId}-title`}>
					{t.units.contentLanguageSupport.title}
				</h3>
				<p className="text-sm text-muted-foreground">
					{t.units.contentLanguageSupport.description}
				</p>
			</div>

			<Field>
				<FieldLabel htmlFor={`${fieldId}-language-tag`}>
					{t.units.contentLanguageSupport.languageTag}
				</FieldLabel>
				<div className="flex flex-col gap-2 sm:flex-row">
					<Input
						aria-describedby={languageTagInvalid ? `${fieldId}-language-tag-error` : undefined}
						aria-invalid={languageTagInvalid}
						disabled={disabled}
						id={`${fieldId}-language-tag`}
						onChange={(event) => {
							setLanguageTagInput(event.currentTarget.value);
							setLanguageTagInvalid(false);
						}}
						onKeyDown={(event) => {
							if (event.key !== "Enter") return;
							event.preventDefault();
							addLanguage();
						}}
						placeholder={t.units.contentLanguageSupport.languageTagPlaceholder}
						value={languageTagInput}
					/>
					<Button disabled={disabled} onClick={addLanguage} type="button" variant="outline">
						{t.units.contentLanguageSupport.addLanguage}
					</Button>
				</div>
				{languageTagInvalid ? (
					<p className="text-sm text-destructive" id={`${fieldId}-language-tag-error`} role="alert">
						{t.units.contentLanguageSupport.invalidLanguageTag}
					</p>
				) : null}
			</Field>

			<div className="grid gap-3">
				{value.map((entry) => (
					<fieldset className="grid gap-3 rounded-lg bg-muted/32 p-3" key={entry.languageTag}>
						<legend className="sr-only">{entry.languageTag}</legend>
						<div className="flex flex-wrap items-center justify-between gap-2">
							<Badge variant="outline">{entry.languageTag}</Badge>
							<Button
								aria-label={`${t.units.contentLanguageSupport.removeLanguage}: ${entry.languageTag}`}
								disabled={disabled}
								onClick={() => onChange(removeContentLanguage(value, entry.languageTag))}
								type="button"
								variant="quiet"
							>
								{t.units.contentLanguageSupport.removeLanguage}
							</Button>
						</div>
						<div className="grid gap-2">
							<p className="text-sm font-medium">{t.units.contentLanguageSupport.channelLabel}</p>
							<div className="flex flex-wrap gap-x-4 gap-y-2">
								{ContentLanguageChannelValues.map((channel) => (
									<ChannelCheckbox
										channel={channel}
										checked={entry.channels?.includes(channel) ?? false}
										disabled={disabled}
										key={channel}
										onChange={() =>
											onChange(toggleContentLanguageChannel(value, entry.languageTag, channel))
										}
									/>
								))}
							</div>
							{entry.channels ? null : (
								<p className="text-xs text-muted-foreground">
									{t.units.contentLanguageSupport.unqualifiedChannels}
								</p>
							)}
						</div>
					</fieldset>
				))}
			</div>
		</section>
	);
}

function ChannelCheckbox({
	channel,
	checked,
	disabled,
	onChange,
}: {
	readonly channel: ContentLanguageChannel;
	readonly checked: boolean;
	readonly disabled: boolean;
	readonly onChange: () => void;
}) {
	const { t } = useTranslation(["units"]);
	return (
		<label className="flex items-center gap-2 text-sm">
			<Checkbox
				checked={checked}
				disabled={disabled}
				onCheckedChange={({ checked: nextChecked }) => {
					if ((nextChecked === true) !== checked) onChange();
				}}
			/>
			{t.units.contentLanguageSupport.channels[channel]}
		</label>
	);
}
