"use client";

import {
	LicenseIds,
	LicenseRegistry,
	RecommendedLicenseId,
	ResidualRightsLicenseId,
	type LicenseId,
} from "@rezics/license";
import { Checkbox, CheckboxGroup, Field, FieldDescription, FieldLabel } from "@rezics/ui";
import { useId, useState } from "react";

import { useTranslation } from "@/i18n/client";
import { reconcileLicenseSelection } from "../model/unit-licenses";

export function UnitLicensesField({
	allowProfileOwnedOnly = true,
	defaultValue = [],
	name = "licenses",
	label,
}: {
	readonly allowProfileOwnedOnly?: boolean;
	readonly defaultValue?: readonly LicenseId[];
	readonly name?: string;
	readonly label?: string;
}) {
	const { t } = useTranslation(["licenses", "units"]);
	const initial = new Set(defaultValue);
	const [selected, setSelected] = useState<LicenseId[]>(() => [...defaultValue]);
	const [acknowledged, setAcknowledged] = useState(false);
	const acknowledgementInputId = useId();
	const acknowledgementLabelId = useId();
	const residualWithOthers = selected.includes(ResidualRightsLicenseId) && selected.length > 1;
	const requiresAcknowledgement = selected.some(
		(id) => !initial.has(id) && LicenseRegistry[id].requiresAffirmativeAcknowledgement,
	);

	function onValueChange(next: string[]) {
		setAcknowledged(false);
		setSelected(
			reconcileLicenseSelection({
				allowProfileOwnedOnly,
				initial: defaultValue,
				next,
				previous: selected,
			}),
		);
	}

	return (
		<>
			<Field>
				<FieldLabel>{label ?? t.units.detail.license}</FieldLabel>
				<CheckboxGroup className="gap-3" name={name} onValueChange={onValueChange} value={selected}>
					{LicenseIds.map((id) => {
						const definition = LicenseRegistry[id];
						const disabled = definition.profileOwnedOnly && !allowProfileOwnedOnly;
						return (
							<div className="grid gap-1" key={id}>
								{disabled && selected.includes(id) ? (
									<input name={name} type="hidden" value={id} />
								) : null}
								<label className="flex items-start gap-2 text-sm">
									<Checkbox disabled={disabled} value={id} />
									<span>{t.licenses.options[id].label}</span>
								</label>
								{definition.termsUrl ? (
									<a
										className="ml-6 w-fit text-link text-sm hover:text-link-hover hover:underline"
										href={definition.termsUrl}
										rel="noreferrer"
										target="_blank"
									>
										{t.licenses.viewTerms}
									</a>
								) : null}
								{disabled && id === RecommendedLicenseId ? (
									<FieldDescription className="ml-6">
										{t.licenses.affirmativeAcknowledgement.profileOwnedOnlyNotice}
									</FieldDescription>
								) : null}
							</div>
						);
					})}
				</CheckboxGroup>
				<FieldDescription>
					{residualWithOthers ? t.licenses.residualRightsNotice : t.licenses.exclusiveSelectionHint}
				</FieldDescription>
			</Field>
			{requiresAcknowledgement ? (
				<Field className="w-auto" orientation="horizontal" required>
					<Checkbox
						aria-labelledby={acknowledgementLabelId}
						checked={acknowledged}
						ids={{ hiddenInput: acknowledgementInputId }}
						name="licenseAcknowledgement"
						onCheckedChange={({ checked }) => setAcknowledged(checked === true)}
						required
					/>
					<FieldLabel
						className="font-normal"
						htmlFor={acknowledgementInputId}
						id={acknowledgementLabelId}
					>
						{t.licenses.affirmativeAcknowledgement.confirmationLabel}
					</FieldLabel>
				</Field>
			) : null}
		</>
	);
}
