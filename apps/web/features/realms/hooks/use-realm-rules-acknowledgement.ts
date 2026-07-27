"use client";

import { toContentLanguage } from "@rezics/i18n";
import {
	useGetApiRealmsByRealmIdRules,
	usePutApiRealmsByRealmIdRulesByRevisionIdAcknowledgement,
} from "@rezics/openapi-tanstack-query";
import { useCallback, useState } from "react";

import { useTranslation } from "@/i18n/client";
import { hasErrorCode } from "@/i18n/errors";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";

type RuleProtectedOperation = () => Promise<void>;
type PendingOperation = {
	readonly execute: RuleProtectedOperation;
	readonly realmId: string;
};

export function useRealmRulesAcknowledgement(realmId: string | undefined) {
	const { locale } = useTranslation(["realms"]);
	const localizationLanguages = useLocalizationLanguages();
	const [open, setOpen] = useState(false);
	const [pendingOperation, setPendingOperation] = useState<PendingOperation>();
	const acknowledgementRealmId = pendingOperation?.realmId ?? realmId;
	const rules = useGetApiRealmsByRealmIdRules(
		{
			path: { realmId: acknowledgementRealmId ?? "" },
			query: { localizationLanguages },
		},
		{ query: { enabled: open && Boolean(acknowledgementRealmId) } },
	);
	const acknowledge = usePutApiRealmsByRealmIdRulesByRevisionIdAcknowledgement();

	const runForRealm = useCallback(
		async (
			operation: RuleProtectedOperation,
			operationRealmId: string | undefined,
		): Promise<void> => {
			try {
				await operation();
			} catch (error) {
				if (!operationRealmId || !hasErrorCode(error, "RealmRulesAcceptanceRequired"))
					throw error;
				setPendingOperation({ execute: operation, realmId: operationRealmId });
				setOpen(true);
			}
		},
		[],
	);
	const run = useCallback(
		(operation: RuleProtectedOperation) => runForRealm(operation, realmId),
		[realmId, runForRealm],
	);

	const close = useCallback(() => {
		if (acknowledge.isPending) return;
		setOpen(false);
		setPendingOperation(undefined);
		acknowledge.reset();
	}, [acknowledge]);

	const confirm = useCallback(async (): Promise<void> => {
		const revisionId = rules.data?.revisionId;
		if (!revisionId || !pendingOperation) return;
		try {
			await acknowledge.mutateAsync({
				path: { realmId: pendingOperation.realmId, revisionId },
				body: { language: toContentLanguage(locale.target) },
			});
		} catch (error) {
			if (hasErrorCode(error, "RealmRuleRevisionChanged")) await rules.refetch();
			return;
		}

		const { execute } = pendingOperation;
		setOpen(false);
		setPendingOperation(undefined);
		acknowledge.reset();
		try {
			await runForRealm(execute, pendingOperation.realmId);
		} catch {
			// The protected mutation owns and renders its typed failure state.
		}
	}, [acknowledge, locale.target, pendingOperation, rules, runForRealm]);

	return {
		close,
		confirm,
		dialogKey: rules.data?.revisionId ?? "pending",
		error: acknowledge.error ?? rules.error,
		isLoading: !rules.data || rules.isFetching,
		isPending: acknowledge.isPending,
		open,
		rules: rules.data?.items,
		run,
	};
}

export type RealmRulesAcknowledgementController = ReturnType<typeof useRealmRulesAcknowledgement>;
