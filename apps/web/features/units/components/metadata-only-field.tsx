"use client";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogBody,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Checkbox,
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
} from "@rezics/ui";
import { useId, useState } from "react";

import { useTranslation } from "@/i18n/client";

export type MetadataOnlyUnitType = "book" | "software" | "media";

export function MetadataOnlyField({
	type,
	value,
	onChange,
	disabled = false,
	confirmFullContent = false,
}: {
	readonly type: MetadataOnlyUnitType;
	readonly value: boolean;
	readonly onChange: (value: boolean) => void;
	readonly disabled?: boolean;
	readonly confirmFullContent?: boolean;
}) {
	const { t } = useTranslation(["units"]);
	const [confirmationOpen, setConfirmationOpen] = useState(false);
	const inputId = useId();
	const descriptionId = useId();

	return (
		<>
			<Field orientation="horizontal">
				<Checkbox
					aria-describedby={descriptionId}
					checked={value}
					disabled={disabled}
					ids={{ hiddenInput: inputId }}
					onCheckedChange={({ checked }) => {
						const next = checked === true;
						if (!next && value && confirmFullContent) {
							setConfirmationOpen(true);
							return;
						}
						onChange(next);
					}}
				/>
				<FieldContent>
					<FieldLabel htmlFor={inputId}>{t.units.fields.metadataOnly}</FieldLabel>
					<FieldDescription id={descriptionId}>
						{t.units.fields.metadataOnlyDescription[type]}
					</FieldDescription>
				</FieldContent>
			</Field>
			<AlertDialog onOpenChange={({ open }) => setConfirmationOpen(open)} open={confirmationOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t.units.creation.metadataOnlyConfirmationTitle}</AlertDialogTitle>
					</AlertDialogHeader>
					<AlertDialogBody>
						<AlertDialogDescription>
							{t.units.creation.metadataOnlyConfirmationDescription}
						</AlertDialogDescription>
					</AlertDialogBody>
					<AlertDialogFooter>
						<AlertDialogCancel>{t.units.creation.metadataOnlyConfirmationCancel}</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								onChange(false);
								setConfirmationOpen(false);
							}}
						>
							{t.units.creation.metadataOnlyConfirmationConfirm}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
