import { StatusCodes } from "http-status-codes";
import Elysia from "elysia";
import { BlockDocument, BlockKey, parseDocument, type Block } from "@rezics/block";
import { SearchConfiguration, SearchExecutionRequest } from "@rezics/search";
import { and, eq } from "drizzle-orm";
import { t } from "elysia";

import { resolveIdentity } from "../../auth/session";
import { executeConfiguredSearch, GlobalSearchConfiguration } from "../../search/configuration";
import { InvalidSearch, SearchUnavailable } from "../../search/errors";
import { SearchCategories } from "../../search/schema";
import { searchDomain, searchGrouped } from "../../search/service";
import { database } from "../../database";
import { zone, zonePage } from "../../database/schema";
import { UnitNotFound } from "../../units/errors";
import { ZonePageNotFound } from "../domain-extensions/errors";
import { Uuid } from "../schema";
import { DomainSearchBody, DomainSearchParams, GroupedSearchBody } from "./schema";
import { toApiErrorResponse, DomainSearchResponse, SearchResponse } from "../schema/response";

const SearchUnavailableResponse = toApiErrorResponse(["SearchUnavailable"]);
const InvalidSearchResponse = toApiErrorResponse(["InvalidSearch"]);

const ZoneDockSearchParams = t.Object({ zoneId: Uuid, blockKey: BlockKey });
const ZonePageSearchParams = t.Object({
	zoneId: Uuid,
	slug: t.String({ minLength: 1, maxLength: 100, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
	blockKey: BlockKey,
});

function findSearchConfiguration(document: typeof BlockDocument.static, blockKey: string) {
	let found: SearchConfiguration | undefined;
	const visit = (block: Block): void => {
		if (block._key === blockKey) {
			if (block._type !== "search")
				throw new InvalidSearch("The selected Block is not a Search Block");
			found = block.configuration;
			return;
		}
		if (block._type === "group" || block._type === "callout") block.blocks.forEach(visit);
		if (block._type === "tabs") block.tabs.forEach((tab) => tab.blocks.forEach(visit));
	};
	document.blocks.forEach(visit);
	if (!found) throw new InvalidSearch("Search Block does not exist in this surface");
	return found;
}

async function executeZoneBlock(input: {
	zoneId: string;
	blockKey: string;
	document: unknown;
	body: unknown;
	profileId?: string;
}) {
	const configuration = findSearchConfiguration(
		parseDocument(BlockDocument, input.document),
		input.blockKey,
	);
	return executeConfiguredSearch(configuration, input.body, input.profileId, input.zoneId);
}

export default new Elysia({ prefix: "/search" })
	.get("/configuration", () => GlobalSearchConfiguration, {
		response: { [StatusCodes.OK]: SearchConfiguration },
		detail: { summary: "Get global Search feature configuration", tags: ["Search"] },
	})
	.post(
		"/execute",
		async ({ body, request }) => {
			try {
				const identity = await resolveIdentity(request.headers, "unit:read");
				return await executeConfiguredSearch(
					GlobalSearchConfiguration,
					body,
					identity.authorization.profileId,
				);
			} catch (cause) {
				if (cause instanceof InvalidSearch) throw cause;
				console.error("Configured search failed", cause);
				throw new SearchUnavailable(cause);
			}
		},
		{
			body: SearchExecutionRequest,
			response: {
				[StatusCodes.OK]: SearchResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: SearchUnavailableResponse,
			},
			detail: { summary: "Execute configured global Search", tags: ["Search"] },
		},
	)
	.post(
		"/zones/:zoneId/dock/blocks/:blockKey/execute",
		async ({ params, body, request }) => {
			const identity = await resolveIdentity(request.headers, "unit:read");
			await identity.authorization.unit.ensureCanRead(
				params.zoneId,
				() => new UnitNotFound("Zone"),
			);
			const [record] = await database
				.select({ document: zone.dockDocument })
				.from(zone)
				.where(eq(zone.id, params.zoneId))
				.limit(1);
			if (!record) throw new UnitNotFound("Zone");
			try {
				return await executeZoneBlock({
					...params,
					document: record.document,
					body,
					profileId: identity.authorization.profileId,
				});
			} catch (cause) {
				if (cause instanceof InvalidSearch || cause instanceof UnitNotFound) throw cause;
				console.error("Zone Dock Search Block execution failed", cause);
				throw new SearchUnavailable(cause);
			}
		},
		{
			params: ZoneDockSearchParams,
			body: SearchExecutionRequest,
			response: {
				[StatusCodes.OK]: SearchResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: SearchUnavailableResponse,
			},
			detail: { summary: "Execute a trusted Zone Dock Search Block", tags: ["Search"] },
		},
	)
	.post(
		"/zones/:zoneId/pages/:slug/blocks/:blockKey/execute",
		async ({ params, body, request }) => {
			const identity = await resolveIdentity(request.headers, "unit:read");
			await identity.authorization.unit.ensureCanRead(
				params.zoneId,
				() => new UnitNotFound("Zone"),
			);
			const [record] = await database
				.select({ document: zonePage.document })
				.from(zonePage)
				.where(and(eq(zonePage.zoneId, params.zoneId), eq(zonePage.slug, params.slug)))
				.limit(1);
			if (!record) throw new ZonePageNotFound();
			try {
				return await executeZoneBlock({
					...params,
					document: record.document,
					body,
					profileId: identity.authorization.profileId,
				});
			} catch (cause) {
				if (
					cause instanceof InvalidSearch ||
					cause instanceof UnitNotFound ||
					cause instanceof ZonePageNotFound
				)
					throw cause;
				console.error("Zone Page Search Block execution failed", cause);
				throw new SearchUnavailable(cause);
			}
		},
		{
			params: ZonePageSearchParams,
			body: SearchExecutionRequest,
			response: {
				[StatusCodes.OK]: SearchResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "ZonePageNotFound"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: SearchUnavailableResponse,
			},
			detail: { summary: "Execute a trusted Zone Page Search Block", tags: ["Search"] },
		},
	)
	.post(
		"",
		async ({ body, request }) => {
			try {
				const identity = await resolveIdentity(request.headers, "unit:read");
				return await searchGrouped({
					...body,
					profileId: identity.authorization.profileId,
					indexes: body.indexes ?? [...SearchCategories],
				});
			} catch (error) {
				if (error instanceof InvalidSearch) throw error;
				console.error("Grouped search failed", error);
				throw new SearchUnavailable(error);
			}
		},
		{
			body: GroupedSearchBody,
			response: {
				[StatusCodes.OK]: SearchResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: SearchUnavailableResponse,
			},
			detail: { summary: "Search across public categories", tags: ["Search"] },
		},
	)
	.post(
		"/:index",
		async ({ params, body, request }) => {
			try {
				const identity = await resolveIdentity(request.headers, "unit:read");
				return await searchDomain(params.index, {
					...body,
					profileId: identity.authorization.profileId,
				});
			} catch (cause) {
				if (cause instanceof InvalidSearch) throw cause;
				console.error("Domain search failed", { index: params.index, error: cause });
				throw new SearchUnavailable(cause);
			}
		},
		{
			params: DomainSearchParams,
			body: DomainSearchBody,
			response: {
				[StatusCodes.OK]: DomainSearchResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: SearchUnavailableResponse,
			},
			detail: { summary: "Search one public category", tags: ["Search"] },
		},
	);
