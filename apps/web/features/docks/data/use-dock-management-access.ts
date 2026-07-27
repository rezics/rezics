"use client";

import {
	type GetApiGovernanceUnitByUnitIdAccessEffectiveStatus200,
	useGetApiGovernanceUnitByUnitIdAccessEffective,
} from "@rezics/openapi-tanstack-query";

import {
	DockKinds,
	dockAuthorizationScope,
	getSupportedDockKinds,
	type DockKind,
} from "../model/dock";

function canUpdate(
	data: GetApiGovernanceUnitByUnitIdAccessEffectiveStatus200 | undefined,
): boolean {
	return (
		data?.decisions.find((candidate) => candidate.permission === "unit.update")?.decision
			.allowed === true
	);
}

export function useDockManagementAccess(unitId: string, ownerKind: string, enabled = true) {
	const supportedKinds = getSupportedDockKinds(ownerKind);
	const mainSupported = supportedKinds.includes("main");
	const wikiSupported = supportedKinds.includes("wiki");
	const main = useGetApiGovernanceUnitByUnitIdAccessEffective(
		{
			path: { unitId },
			query: { scope: [...dockAuthorizationScope("main")] },
		},
		{ query: { enabled: enabled && mainSupported } },
	);
	const wiki = useGetApiGovernanceUnitByUnitIdAccessEffective(
		{
			path: { unitId },
			query: { scope: [...dockAuthorizationScope("wiki")] },
		},
		{ query: { enabled: enabled && wikiSupported } },
	);
	const queries = { main, wiki } as const;
	const allowedKinds = DockKinds.filter(
		(kind): kind is DockKind => supportedKinds.includes(kind) && canUpdate(queries[kind].data),
	);
	const pending =
		(enabled && mainSupported && main.isPending) ||
		(enabled && wikiSupported && wiki.isPending);
	const error =
		(enabled && mainSupported && main.isError ? main.error : undefined) ??
		(enabled && wikiSupported && wiki.isError ? wiki.error : undefined);

	return {
		allowedKinds,
		error,
		pending,
		refetch: async () => {
			await Promise.all([
				...(enabled && mainSupported ? [main.refetch()] : []),
				...(enabled && wikiSupported ? [wiki.refetch()] : []),
			]);
		},
	};
}
