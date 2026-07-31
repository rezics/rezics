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
	Button,
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
import { useState } from "react";

import { useTranslation } from "@/i18n/client";
import { unitContentLicenseHref } from "../model/unit-content-license";

const NoUnitContentLicenseSelection = "none";

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
				{granted
					? t.licenses.unitContent.grantedNotice
					: t.licenses.unitContent.grantNotice}
			</FieldDescription>
			{granted ? (
				<FieldDescription>{t.licenses.unitContent.contributionNotice}</FieldDescription>
			) : null}
			<UnitContentLicenseLink referenceSlug={referenceSlug} />
		</>
	);
}

export function UnitContentLicenseField({
	defaultSlug,
}: {
	readonly defaultSlug: UnitContentLicenseSlug | null;
}) {
	const { t } = useTranslation(["licenses", "units"]);
	const [selectedSlug, setSelectedSlug] = useState<UnitContentLicenseSlug | null>(defaultSlug);
	const [pendingSlug, setPendingSlug] = useState<UnitContentLicenseSlug | null>(null);
	const committedSlug = defaultSlug ?? selectedSlug;
	const referenceSlug =
		defaultSlug ?? pendingSlug ?? selectedSlug ?? CurrentUnitContentLicenseSlug;

	return (
		<>
			<Field>
				<div className="flex items-center gap-1">
					<FieldLabel>{t.units.fields.contentLicense}</FieldLabel>
					<HoverCard
						closeDelay={160}
						openDelay={240}
						positioning={{ placement: "bottom-start" }}
					>
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
								granted={defaultSlug !== null}
								referenceSlug={referenceSlug}
							/>
						</HoverCardContent>
					</HoverCard>
				</div>
				<NativeSelect
					disabled={defaultSlug !== null}
					name="contentLicense"
					onChange={(event) => {
						const selection = event.currentTarget.value;
						if (isUnitContentLicenseSlug(selection)) setPendingSlug(selection);
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
			</Field>
			<AlertDialog
				onOpenChange={(open) => {
					if (!open) setPendingSlug(null);
				}}
				open={pendingSlug !== null}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t.licenses.unitContent.options[referenceSlug].label}
						</AlertDialogTitle>
					</AlertDialogHeader>
					<AlertDialogBody className="flex flex-col gap-3">
						<AlertDialogDescription>
							{t.licenses.unitContent.grantNotice}
						</AlertDialogDescription>
						<UnitContentLicenseLink referenceSlug={referenceSlug} />
					</AlertDialogBody>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => setPendingSlug(null)}>
							{t.licenses.unitContent.cancelGrant}
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (pendingSlug) setSelectedSlug(pendingSlug);
								setPendingSlug(null);
							}}
						>
							{t.licenses.unitContent.confirmGrant}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
