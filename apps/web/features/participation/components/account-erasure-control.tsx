"use client";

import { useEraseOwnAccount } from "@rezics/openapi-tanstack-query";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogCancel,
	AlertDialogTrigger,
	Button,
	Checkbox,
	Field,
	FieldLabel,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { authClient } from "@/lib/auth-client";

export function AccountErasureControl() {
	const { t } = useTranslation(["settings", "collections"]);
	const client = useQueryClient();
	const confirmationId = useId();
	const [confirmed, setConfirmed] = useState(false);
	const [erased, setErased] = useState(false);
	const erase = useEraseOwnAccount({ mutation: { retry: false } });
	async function eraseAccount() {
		if (!confirmed) return;
		try {
			await erase.mutateAsync(undefined);
			setErased(true);
			client.clear();
			await authClient.signOut().catch(() => undefined);
			window.location.assign("/");
		} catch {
			/* Erasure errors remain visible; success never offers to reverse deletion. */
		}
	}
	if (erased) return <p role="status">{t.settings.participation.erased}</p>;
	return (
		<AlertDialog
			onOpenChange={({ open }) => {
				if (!open) setConfirmed(false);
			}}
		>
			<AlertDialogTrigger asChild>
				<Button variant="destructive">{t.settings.participation.eraseTitle}</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t.settings.participation.eraseTitle}</AlertDialogTitle>
					<AlertDialogDescription>
						{t.settings.participation.eraseDescription}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<Field>
					<Checkbox
						id={confirmationId}
						checked={confirmed}
						onCheckedChange={({ checked }) => setConfirmed(checked === true)}
					/>
					<FieldLabel htmlFor={confirmationId}>
						{t.settings.participation.eraseConfirmation}
					</FieldLabel>
				</Field>
				<RequestFailure error={erase.error} />
				<AlertDialogFooter>
					<AlertDialogCancel>{t.collections.cancel}</AlertDialogCancel>
					<Button
						variant="destructive"
						disabled={!confirmed}
						isLoading={erase.isPending}
						onClick={() => void eraseAccount()}
					>
						{t.settings.participation.erase}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
