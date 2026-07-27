"use client";

import { RequestFailure } from "@/i18n/request-failure";
import type { RealmRulesAcknowledgementController } from "../hooks/use-realm-rules-acknowledgement";
import {
	RealmRulesAcknowledgementDialog,
	type RealmRulesAcknowledgementIntent,
} from "./realm-rules-acknowledgement-dialog";

export function RealmRulesAcknowledgementPrompt({
	controller,
	intent,
}: {
	readonly controller: RealmRulesAcknowledgementController;
	readonly intent: RealmRulesAcknowledgementIntent;
}) {
	if (!controller.open) return null;
	return (
		<RealmRulesAcknowledgementDialog
			key={controller.dialogKey}
			error={<RequestFailure error={controller.error} />}
			intent={intent}
			isLoading={controller.isLoading}
			isPending={controller.isPending}
			onConfirm={() => void controller.confirm()}
			onOpenChange={(open) => {
				if (!open) controller.close();
			}}
			open={controller.open}
			rules={controller.rules}
		/>
	);
}
