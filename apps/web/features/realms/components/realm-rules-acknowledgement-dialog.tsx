"use client";

import { Square, SquareCheckBig } from "lucide-react";
import { useState, type ReactNode } from "react";

import {
	Button,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	Skeleton,
} from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { RealmRulesCard, type RealmRulePresentation } from "./realm-rules-card";

export type RealmRulesAcknowledgementIntent = "join" | "publish";

export function RealmRulesAcknowledgementDialog({
	error,
	intent,
	isLoading,
	isPending,
	onConfirm,
	onOpenChange,
	open,
	rules,
}: {
	readonly error?: ReactNode;
	readonly intent: RealmRulesAcknowledgementIntent;
	readonly isLoading: boolean;
	readonly isPending: boolean;
	readonly onConfirm: () => void;
	readonly onOpenChange: (open: boolean) => void;
	readonly open: boolean;
	readonly rules?: readonly RealmRulePresentation[];
}) {
	const { t } = useTranslation(["realms"]);
	const [accepted, setAccepted] = useState(false);
	const title = intent === "join" ? t.realms.joinRulesTitle : t.realms.publishRulesTitle;
	const description =
		intent === "join" ? t.realms.joinRulesDescription : t.realms.publishRulesDescription;
	const confirm = intent === "join" ? t.realms.joinRulesConfirm : t.realms.publishRulesConfirm;

	function changeOpen(nextOpen: boolean) {
		if (isPending) return;
		if (!nextOpen) setAccepted(false);
		onOpenChange(nextOpen);
	}

	return (
		<Dialog onOpenChange={({ open: nextOpen }) => changeOpen(nextOpen)} open={open}>
			<DialogContent showCloseButton={!isPending} size="lg">
				<DialogHeader description={description} title={title} />
				<DialogBody className="grid gap-5">
					{isLoading ? (
						<div className="grid gap-3">
							<Skeleton className="h-14 rounded-xl" />
							<Skeleton className="h-14 rounded-xl" />
						</div>
					) : rules?.length ? (
						<RealmRulesCard rules={rules} title={t.realms.rules} />
					) : null}
					<Button
						aria-pressed={accepted}
						className="h-auto w-full justify-start whitespace-normal px-3 py-2 text-start leading-6"
						disabled={isLoading || isPending || !rules?.length}
						onClick={() => setAccepted((current) => !current)}
						type="button"
						variant="quiet"
					>
						{accepted ? <SquareCheckBig aria-hidden /> : <Square aria-hidden />}
						<span>{t.realms.rulesAgreement}</span>
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
						{t.realms.rulesCancel}
					</Button>
					<Button
						disabled={!accepted || isLoading || isPending || !rules?.length}
						isLoading={isPending}
						onClick={() => {
							if (accepted) onConfirm();
						}}
						type="button"
						variant="solid"
					>
						{confirm}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
