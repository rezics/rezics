"use client";

import { Square, SquareCheckBig } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { RealmRulesCard, type RealmRulePresentation } from "./realm-rules-card";

export function RealmJoinRulesDialog({
	error,
	isPending,
	onConfirm,
	onOpenChange,
	open,
	rules,
}: {
	readonly error?: ReactNode;
	readonly isPending: boolean;
	readonly onConfirm: () => void;
	readonly onOpenChange: (open: boolean) => void;
	readonly open: boolean;
	readonly rules: readonly RealmRulePresentation[];
}) {
	const { t } = useTranslation(["realms"]);
	const [accepted, setAccepted] = useState(false);

	function changeOpen(nextOpen: boolean) {
		if (isPending) return;
		if (!nextOpen) setAccepted(false);
		onOpenChange(nextOpen);
	}

	return (
		<Dialog onOpenChange={({ open: nextOpen }) => changeOpen(nextOpen)} open={open}>
			<DialogContent showCloseButton={!isPending} size="lg">
				<DialogHeader
					description={t.realms.joinRulesDescription}
					title={t.realms.joinRulesTitle}
				/>
				<DialogBody className="grid gap-5">
					<RealmRulesCard rules={rules} title={t.realms.rules} />
					<Button
						aria-pressed={accepted}
						className="h-auto w-full justify-start whitespace-normal px-3 py-2 text-start leading-6"
						disabled={isPending}
						onClick={() => setAccepted((current) => !current)}
						type="button"
						variant="quiet"
					>
						{accepted ? <SquareCheckBig aria-hidden /> : <Square aria-hidden />}
						<span>{t.realms.joinRulesAgreement}</span>
					</Button>
					{error}
				</DialogBody>
				<DialogFooter>
					<Button
						disabled={isPending}
						onClick={() => changeOpen(false)}
						type="button"
						variant="outline"
					>
						{t.realms.joinRulesCancel}
					</Button>
					<Button
						disabled={!accepted}
						isLoading={isPending}
						onClick={() => {
							if (accepted) onConfirm();
						}}
						type="button"
						variant="solid"
					>
						{t.realms.joinRulesConfirm}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
