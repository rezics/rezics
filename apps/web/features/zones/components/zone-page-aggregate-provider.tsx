"use client";

import { encodeBlockPath, type BlockPath } from "@rezics/block";
import type { ContentLanguage } from "@rezics/i18n";
import { client } from "@rezics/openapi-tanstack-query";
import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";

import { getErrorCode } from "@/i18n/errors";
import {
	parseZonePageAggregateResponse,
	type ZoneAggregateBlockState,
	type ZonePageAggregateResponse,
} from "../model/zone-page-aggregate";
import type { ZoneRenderPage } from "../model/zone-render";

interface ZonePageAggregateContextValue {
	readonly errorCode?: string;
	readonly dockResults?: ReadonlyMap<string, ZoneAggregateBlockState>;
	readonly pageResults?: ReadonlyMap<string, ZoneAggregateBlockState>;
	readonly response?: ZonePageAggregateResponse;
	readonly status: "pending" | "ready" | "error";
}

const ZonePageAggregateContext = createContext<ZonePageAggregateContextValue | null>(null);

async function executeZonePageAggregate({
	localizationLanguages,
	page,
	signal,
	zoneId,
}: {
	readonly localizationLanguages: readonly ContentLanguage[];
	readonly page: ZoneRenderPage;
	readonly signal: AbortSignal;
	readonly zoneId: string;
}) {
	const response = await client({
		method: "POST",
		url: "/api/v1/search/zones/{zoneId}/pages/{pageId}/execute",
		path: { zoneId, pageId: page.id },
		body: {
			pageRevision: page.latestUnitRevisionId,
			includeDock: true,
			localizationLanguages,
		},
		security: [
			{ type: "http", scheme: "bearer" },
			{ type: "apiKey", name: "better-auth.session_token", in: "cookie" },
		],
		signal,
	});
	return parseZonePageAggregateResponse(response.data);
}

export function ZonePageAggregateProvider({
	children,
	localizationLanguages,
	onRevisionConflict,
	page,
	zoneId,
}: {
	readonly children: ReactNode;
	readonly localizationLanguages: readonly ContentLanguage[];
	readonly onRevisionConflict: () => void;
	readonly page: ZoneRenderPage;
	readonly zoneId: string;
}) {
	const aggregate = useQuery({
		queryKey: [
			"zone-page-aggregate",
			zoneId,
			page.id,
			page.latestUnitRevisionId,
			localizationLanguages,
		],
		queryFn: ({ signal }) =>
			executeZonePageAggregate({ localizationLanguages, page, signal, zoneId }),
		retry: false,
	});
	const mismatchHandled = useRef<string | undefined>(undefined);
	const responseRevision = aggregate.data?.pageRevision;
	const revisionMismatch =
		(responseRevision !== undefined && responseRevision !== page.latestUnitRevisionId) ||
		getErrorCode(aggregate.error) === "UnitRevisionConflict";

	useEffect(() => {
		if (!revisionMismatch) return;
		const identity = responseRevision ?? page.latestUnitRevisionId;
		if (mismatchHandled.current === identity) return;
		mismatchHandled.current = identity;
		onRevisionConflict();
	}, [onRevisionConflict, page.latestUnitRevisionId, responseRevision, revisionMismatch]);

	const indexedResults = useMemo(() => {
		if (!aggregate.data) return;
		return {
			pageResults: new Map(
				aggregate.data.page.results.map(({ outcome, path }) => [encodeBlockPath(path), outcome]),
			),
			...(aggregate.data.dock
				? {
						dockResults: new Map(
							aggregate.data.dock.results.map(({ outcome, path }) => [
								encodeBlockPath(path),
								outcome,
							]),
						),
					}
				: {}),
		};
	}, [aggregate.data]);

	const value = useMemo<ZonePageAggregateContextValue>(() => {
		if (aggregate.isPending || revisionMismatch) return { status: "pending" };
		if (aggregate.isError)
			return { status: "error", errorCode: getErrorCode(aggregate.error) ?? "unavailable" };
		return aggregate.data
			? { status: "ready", response: aggregate.data, ...indexedResults }
			: { status: "error", errorCode: "invalid_response" };
	}, [
		aggregate.data,
		aggregate.error,
		aggregate.isError,
		aggregate.isPending,
		indexedResults,
		revisionMismatch,
	]);

	return <ZonePageAggregateContext value={value}>{children}</ZonePageAggregateContext>;
}

export function useZoneAggregateBlockState(
	surface: "page" | "dock" | undefined,
	path: BlockPath,
): ZoneAggregateBlockState {
	const aggregate = useContext(ZonePageAggregateContext);
	if (!aggregate || !surface) return { kind: "legacy" };
	if (aggregate.status === "pending") return { kind: "pending" };
	if (aggregate.status === "error")
		return { kind: "error", code: aggregate.errorCode ?? "unavailable" };
	const results = surface === "page" ? aggregate.pageResults : aggregate.dockResults;
	return results?.get(encodeBlockPath(path)) ?? { kind: "error", code: "missing_result" };
}

export function useZoneAggregateStatus(): "legacy" | ZonePageAggregateContextValue["status"] {
	return useContext(ZonePageAggregateContext)?.status ?? "legacy";
}
