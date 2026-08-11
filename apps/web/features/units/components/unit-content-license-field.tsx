"use client";

import {
	CurrentUnitContentLicenseSlug,
	isUnitContentLicenseSlug,
	type UnitContentLicenseSlug,
} from "@rezics/license";
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
	Badge,
	Button,
	Checkbox,
	Field,
	FieldDescription,
	FieldLabel,
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
	NativeSelect,
	NativeSelectOption,
} from "@rezics/ui";
import { CircleHelp } from "lucide-react";
import { useId, useState } from "react";

import { useTranslation } from "@/i18n/client";
import { unitContentLicenseHref } from "../model/unit-content-license";

const NoUnitContentLicenseSelection = "none";

type UnitContentLicenseFieldProps =
	| { readonly context: "create" }
	| {
			readonly context: "edit";
			readonly grantedSlug: UnitContentLicenseSlug | null;
	  };

type PendingContentLicenseChange =
	| { readonly kind: "select-none" }
	| { readonly kind: "grant"; readonly slug: UnitContentLicenseSlug };

function UnitContentLicenseLink({
	referenceSlug,
}: {
	readonly referenceSlug: UnitContentLicenseSlug;
}) {
	const { t } = useTranslation(["licenses"]);

	return (
		<a
			className="w-fit text-link text-sm hover:text-link-hover hover:underline"
			href={unitContentLicenseHref(referenceSlug)}
			rel="noreferrer"
		>
			{t.licenses.unitContent.viewTerms}
		</a>
	);
}

function UnitContentLicenseSummary({
	granted,
	referenceSlug,
}: {
	readonly granted: boolean;
	readonly referenceSlug: UnitContentLicenseSlug;
}) {
	const { t } = useTranslation(["licenses"]);

	return (
		<>
			<p className="font-medium">{t.licenses.unitContent.options[referenceSlug].label}</p>
			<FieldDescription>
				{granted ? t.licenses.unitContent.grantedNotice : t.licenses.unitContent.grantNotice}
			</FieldDescription>
			{granted ? (
				<FieldDescription>{t.licenses.unitContent.contributionNotice}</FieldDescription>
			) : null}
			<UnitContentLicenseLink referenceSlug={referenceSlug} />
		</>
	);
}

export function UnitContentLicenseField(props: UnitContentLicenseFieldProps) {
	const { t } = useTranslation(["licenses", "units"]);
	const existingGrant = props.context === "edit" ? props.grantedSlug : null;
	const [selectedSlug, setSelectedSlug] = useState<UnitContentLicenseSlug | null>(() =>
		props.context === "create" ? CurrentUnitContentLicenseSlug : props.grantedSlug,
	);
	const [licenseConfirmed, setLicenseConfirmed] = useState(false);
	const [pendingChange, setPendingChange] = useState<PendingContentLicenseChange | null>(null);
	const confirmationInputId = useId();
	const confirmationLabelId = useId();
	const committedSlug = existingGrant ?? selectedSlug;
	const referenceSlug =
		existingGrant ??
		(pendingChange?.kind === "grant" ? pendingChange.slug : selectedSlug) ??
		CurrentUnitContentLicenseSlug;
	const grantAlreadyExists = existingGrant !== null;
	const pendingNoneSelection = pendingChange?.kind === "select-none";
	const pendingGrant = pendingChange?.kind === "grant";

	return (
		<>
			<Field>
				<div className="flex items-center gap-1">
					<FieldLabel>{t.units.fields.contentLicense}</FieldLabel>
					<HoverCard closeDelay={160} openDelay={240} positioning={{ placement: "bottom-start" }}>
						<HoverCardTrigger asChild>
							<Button
								aria-label={t.licenses.unitContent.viewTerms}
								size="icon-xs"
								type="button"
								variant="quiet"
							>
								<CircleHelp aria-hidden />
							</Button>
						</HoverCardTrigger>
						<HoverCardContent className="grid w-[min(22rem,calc(100vw-2rem))] gap-3">
							<UnitContentLicenseSummary
								granted={grantAlreadyExists}
								referenceSlug={referenceSlug}
							/>
						</HoverCardContent>
					</HoverCard>
				</div>
				<NativeSelect
					disabled={grantAlreadyExists}
					name="contentLicense"
					onChange={(event) => {
						const selection = event.currentTarget.value;
						if (isUnitContentLicenseSlug(selection)) {
							if (props.context === "create") {
								setSelectedSlug(selection);
								setLicenseConfirmed(false);
							} else setPendingChange({ kind: "grant", slug: selection });
							return;
						}
						if (props.context === "create" && selectedSlug !== null)
							setPendingChange({ kind: "select-none" });
						else setSelectedSlug(null);
					}}
					value={committedSlug ?? NoUnitContentLicenseSelection}
				>
					<NativeSelectOption value={NoUnitContentLicenseSelection}>
						{t.licenses.unitContent.none}
					</NativeSelectOption>
					<NativeSelectOption value={CurrentUnitContentLicenseSlug}>
						{t.licenses.unitContent.options[CurrentUnitContentLicenseSlug].label}
					</NativeSelectOption>
				</NativeSelect>
				<FieldDescription>
					{grantAlreadyExists
						? t.licenses.unitContent.grantedNotice
						: committedSlug
							? t.licenses.unitContent.grantNotice
							: t.licenses.unitContent.noneNotice}
				</FieldDescription>
			</Field>
			{committedSlug ? (
				<Field className="w-auto" orientation="horizontal" required>
					<Checkbox
						aria-labelledby={confirmationLabelId}
						checked={licenseConfirmed}
						ids={{ hiddenInput: confirmationInputId }}
						name="contentLicenseConfirmation"
						onCheckedChange={({ checked }) => setLicenseConfirmed(checked === true)}
						required
					/>
					<FieldLabel
						className="font-normal"
						htmlFor={confirmationInputId}
						id={confirmationLabelId}
					>
						{t.licenses.unitContent.confirmationLabel}
					</FieldLabel>
				</Field>
			) : null}
			<AlertDialog
				onOpenChange={(open) => {
					if (!open) setPendingChange(null);
				}}
				open={pendingChange !== null}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{pendingNoneSelection
								? t.licenses.unitContent.noneConfirmationTitle
								: t.licenses.unitContent.options[referenceSlug].label}
						</AlertDialogTitle>
					</AlertDialogHeader>
					<AlertDialogBody className="flex flex-col gap-3">
						<AlertDialogDescription>
							{pendingNoneSelection
								? t.licenses.unitContent.noneConfirmationNotice
								: t.licenses.unitContent.grantNotice}
						</AlertDialogDescription>
						{pendingGrant ? <UnitContentLicenseLink referenceSlug={referenceSlug} /> : null}
					</AlertDialogBody>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => setPendingChange(null)}>
							{pendingNoneSelection
								? t.licenses.unitContent.keepLicense
								: t.licenses.unitContent.cancelGrant}
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (pendingChange?.kind === "grant") {
									setSelectedSlug(pendingChange.slug);
									setLicenseConfirmed(false);
								}
								if (pendingChange?.kind === "select-none") {
									setSelectedSlug(null);
									setLicenseConfirmed(false);
								}
								setPendingChange(null);
							}}
						>
							{pendingNoneSelection
								? t.licenses.unitContent.confirmNone
								: t.licenses.unitContent.confirmGrant}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

export function PublicWorkContentLicenseField() {
	const { t } = useTranslation(["licenses", "units"]);

	return (
		<Field>
			<FieldLabel>{t.units.fields.contentLicense}</FieldLabel>
			<Badge className="w-fit" variant="outline">
				{t.licenses.unitContent.none}
			</Badge>
			<FieldDescription>{t.licenses.unitContent.publicWorkNotice}</FieldDescription>
		</Field>
	);
}
