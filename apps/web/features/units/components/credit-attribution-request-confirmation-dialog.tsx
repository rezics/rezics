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
} from "@rezics/ui";

import { useTranslation } from "@/i18n/client";

export function CreditAttributionRequestConfirmationDialog({
	open,
	pending,
	onCancel,
	onConfirm,
}: {
	readonly open: boolean;
	readonly pending: boolean;
	readonly onCancel: () => void;
	readonly onConfirm: () => void;
}) {
	const { t } = useTranslation(["units"]);

	return (
		<AlertDialog
			onOpenChange={(nextOpen) => {
				if (!nextOpen && !pending) onCancel();
			}}
			open={open}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t.units.creation.creditRequestConfirmationTitle}</AlertDialogTitle>
				</AlertDialogHeader>
				<AlertDialogBody>
					<AlertDialogDescription>
						{t.units.creation.creditRequestConfirmationDescription}
					</AlertDialogDescription>
				</AlertDialogBody>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={pending} onClick={onCancel}>
						{t.units.creation.creditRequestConfirmationCancel}
					</AlertDialogCancel>
					<AlertDialogAction disabled={pending} onClick={onConfirm}>
						{t.units.creation.creditRequestConfirmationConfirm}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
