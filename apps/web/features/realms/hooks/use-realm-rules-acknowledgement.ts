"use client";
import { getRealmMembership } from "@rezics/openapi-tanstack-query";
import { useRealmMembershipContext } from "./use-realm-membership-context";
import { realmMembershipPreconditions } from "../data/membership-preconditions";

import { toContentLanguage } from "@rezics/i18n";
import {
	useGetRealmEnrollmentRules,
	useAcknowledgeRealmRules,
} from "@rezics/openapi-tanstack-query";
import { useCallback, useState } from "react";

import { useTranslation } from "@/i18n/client";
import { getErrorDetails, hasErrorCode } from "@/i18n/errors";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";

type RuleProtectedOperation = () => Promise<void>;
type PendingOperation = {
	readonly execute: RuleProtectedOperation;
	readonly operationRealmIds: readonly string[];
	readonly remainingRealmIds: readonly [string, ...string[]];
};

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === "object" && value !== null;
}

function requiredRealmIdsFromError(
	error: unknown,
	operationRealmIds: readonly string[],
): readonly string[] {
	const details = getErrorDetails(error);
	if (!isRecord(details) || !Array.isArray(details.realms)) return operationRealmIds;
	const operationRealmIdSet = new Set(operationRealmIds);
	const required = details.realms.flatMap((value) =>
		isRecord(value) && typeof value.realmId === "string" && operationRealmIdSet.has(value.realmId)
			? [value.realmId]
			: [],
	);
	return [...new Set(required)];
}

export function useRealmRulesAcknowledgement(realmIds: readonly string[]) {
	const { locale } = useTranslation(["realms"]);
	const localizationLanguages = useLocalizationLanguages();
	const [open, setOpen] = useState(false);
	const [preconditionError, setPreconditionError] = useState<unknown>();
	const [pendingOperation, setPendingOperation] = useState<PendingOperation>();
	const realmIdsKey = realmIds.join("\u0000");
	const operationRealmIds = realmIdsKey ? realmIdsKey.split("\u0000") : [];
	const acknowledgementRealmId = pendingOperation?.remainingRealmIds[0];
	const context = useRealmMembershipContext();
	const rules = useGetRealmEnrollmentRules(
		{
			path: { realmId: acknowledgementRealmId ?? "" },
			query: { localizationLanguages },
		},
		{
			query: {
				enabled: context.ready && open && Boolean(acknowledgementRealmId),
				queryKey: [
					"realm-enrollment-rules",
					acknowledgementRealmId,
					localizationLanguages,
					context.selectionKey,
				],
			},
			client: { client: context.client },
		},
	);
	const acknowledge = useAcknowledgeRealmRules({ client: { client: context.client } });

	const runForRealms = useCallback(
		async (
			operation: RuleProtectedOperation,
			protectedRealmIds: readonly string[],
		): Promise<void> => {
			try {
				await operation();
			} catch (error) {
				if (!protectedRealmIds.length || !hasErrorCode(error, "RealmRulesAcceptanceRequired"))
					throw error;
				const requiredRealmIds = requiredRealmIdsFromError(error, protectedRealmIds);
				const [firstRealmId, ...remainingRealmIds] = requiredRealmIds;
				if (!firstRealmId) throw error;
				setPendingOperation({
					execute: operation,
					operationRealmIds: protectedRealmIds,
					remainingRealmIds: [firstRealmId, ...remainingRealmIds],
				});
				setOpen(true);
			}
		},
		[],
	);
	const run = useCallback(
		(operation: RuleProtectedOperation) => runForRealms(operation, operationRealmIds),
		[operationRealmIds, runForRealms],
	);

	const close = useCallback(() => {
		if (acknowledge.isPending) return;
		setOpen(false);
		setPendingOperation(undefined);
		acknowledge.reset();
	}, [acknowledge]);

	const confirm = useCallback(async (): Promise<void> => {
		const revisionId = rules.data?.revisionId;
		if (!revisionId || !pendingOperation || !context.client) return;
		const currentRealmId = pendingOperation.remainingRealmIds[0];
		setPreconditionError(undefined);
		try {
			const status = await getRealmMembership({
				path: { realmId: currentRealmId },
				client: context.client,
			}).unwrap();
			await acknowledge.mutateAsync({
				path: { realmId: currentRealmId, revisionId },
				body: {
					...realmMembershipPreconditions(status),
					consent: true,
					language: toContentLanguage(locale.target),
				},
			});
		} catch (error) {
			setPreconditionError(error);
			if (hasErrorCode(error, "AccessChanged")) await rules.refetch();
			return;
		}

		acknowledge.reset();
		const [, ...remainingRealmIds] = pendingOperation.remainingRealmIds;
		const [nextRealmId, ...laterRealmIds] = remainingRealmIds;
		if (nextRealmId) {
			setPendingOperation({
				...pendingOperation,
				remainingRealmIds: [nextRealmId, ...laterRealmIds],
			});
			return;
		}

		const { execute, operationRealmIds: protectedRealmIds } = pendingOperation;
		setOpen(false);
		setPendingOperation(undefined);
		try {
			await runForRealms(execute, protectedRealmIds);
		} catch {
			// The protected mutation owns and renders its typed failure state.
		}
	}, [acknowledge, context.client, locale.target, pendingOperation, rules, runForRealms]);

	return {
		close,
		confirm,
		dialogKey: `${acknowledgementRealmId ?? "pending"}:${rules.data?.revisionId ?? "pending"}`,
		error: preconditionError ?? acknowledge.error ?? rules.error,
		isLoading: !rules.data || rules.isFetching,
		isPending: acknowledge.isPending,
		open,
		rules: rules.data?.items,
		run,
	};
}

export type RealmRulesAcknowledgementController = ReturnType<typeof useRealmRulesAcknowledgement>;
