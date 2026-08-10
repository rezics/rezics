"use client";

import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import {
	Button,
	EntityPicker,
	Field,
	FieldError,
	FieldLegend,
	FieldLabel,
	FieldSet,
	NativeSelect,
	NativeSelectOption,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
	type EntitySearch,
	useEntitySearch,
} from "@rezics/ui";

import { EntityCreationHelp } from "@/features/create/components/entity-creation-help";
import { useTranslation } from "@/i18n/client";
import {
	CreditAttributionRolesByUnitType,
	isCreditAttributionRoleForUnitType,
} from "../attribution-role";
import type {
	CreditAttributionDraft,
	CreditAttributionDraftValidation,
} from "../model/credit-attribution-draft";
import { createCreditAttributionDraft } from "../model/credit-attribution-draft";
import type { VariantUnitType } from "../unit-types";

export type CreditEntitySearchScope = "direct" | "public";

export function UnitCreditAttributionEditor({
	type,
	value,
	validation,
	searchScope,
	onChange,
}: {
	readonly type: VariantUnitType;
	readonly value: readonly CreditAttributionDraft[];
	readonly validation?: CreditAttributionDraftValidation;
	readonly searchScope: CreditEntitySearchScope;
	readonly onChange: (value: readonly CreditAttributionDraft[]) => void;
}) {
	const { t } = useTranslation(["ui", "units"]);
	const searchEntities = useEntitySearch();
	const scopedSearch = useMemo<EntitySearch | undefined>(() => {
		if (!searchEntities) return undefined;
		return (index, query, signal, options) =>
			searchEntities(index, query, signal, {
				...options,
				creditAttributionSearch: searchScope,
			});
	}, [searchEntities, searchScope]);

	return (
		<FieldSet className="gap-3">
			<FieldLegend className="flex items-center gap-1">
				{t.units.creation.creditAttributionsTitle}
				<EntityCreationHelp />
			</FieldLegend>
			<div className="grid gap-3">
				{value.map((draft, index) => {
					const number = index + 1;
					const issue = validation?.issues[draft.key];
					const entityInvalid = Boolean(issue?.entityRequired || issue?.duplicate);
					const roleInvalid = Boolean(issue?.roleRequired);
					return (
						<div
							className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)_2.25rem] sm:items-start"
							key={draft.key}
						>
							<Field invalid={roleInvalid} required>
								<FieldLabel className="sr-only">
									{t.units.creation.creditRoleLabel({ number })}
								</FieldLabel>
								<NativeSelect
									invalid={roleInvalid}
									onChange={(event) => {
										const role = event.currentTarget.value;
										onChange(
											value.map((item) =>
												item.key === draft.key
													? {
															...item,
															role: isCreditAttributionRoleForUnitType(
																type,
																role,
															)
																? role
																: undefined,
														}
													: item,
											),
										);
									}}
									value={draft.role}
								>
									{CreditAttributionRolesByUnitType[type].map((role) => (
										<NativeSelectOption key={role} value={role}>
											{t.units.attributionRoles[role]}
										</NativeSelectOption>
									))}
								</NativeSelect>
								{issue?.roleRequired ? (
									<FieldError>{t.units.creation.creditRoleRequired}</FieldError>
								) : null}
							</Field>
							<Field invalid={entityInvalid} required>
								<FieldLabel className="sr-only">
									{t.units.creation.creditEntityLabel({ number })}
								</FieldLabel>
								<EntityPicker
									ariaLabel={t.units.creation.creditEntityLabel({ number })}
									index="entities"
									invalid={entityInvalid}
									onChange={(entity) =>
										onChange(
											value.map((item) =>
												item.key === draft.key ? { ...item, entity } : item,
											),
										)
									}
									onClear={() =>
										onChange(
											value.map((item) =>
												item.key === draft.key
													? { ...item, entity: undefined }
													: item,
											),
										)
									}
									placeholder={t.ui.pickerPlaceholders.entity}
									search={scopedSearch}
									searchOnOpen
									value={draft.entity}
								/>
								{issue?.entityRequired ? (
									<FieldError>{t.units.creation.creditEntityRequired}</FieldError>
								) : issue?.duplicate ? (
									<FieldError>{t.units.creation.creditDuplicate}</FieldError>
								) : null}
							</Field>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										aria-label={t.units.creation.removeCreditAttribution({
											number,
										})}
										onClick={() =>
											onChange(value.filter((item) => item.key !== draft.key))
										}
										size="icon-md"
										type="button"
										variant="quiet"
									>
										<Trash2 aria-hidden className="size-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									{t.units.creation.removeCreditAttribution({ number })}
								</TooltipContent>
							</Tooltip>
						</div>
					);
				})}
			</div>
			<Button
				className="w-fit"
				onClick={() => onChange([...value, createCreditAttributionDraft(type)])}
				type="button"
				variant="outline"
			>
				{t.units.creation.addCreditAttribution}
			</Button>
		</FieldSet>
	);
}
