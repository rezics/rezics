import { StatusCodes } from "http-status-codes";
import Elysia from "elysia";

import { InvalidSearch, SearchUnavailable } from "../../search/errors";
import { SearchCategories } from "../../search/schema";
import { searchDomain, searchGrouped } from "../../search/service";
import { DomainSearchBody, DomainSearchParams, GroupedSearchBody } from "./schema";
import { toApiErrorResponse, DomainSearchResponse, SearchResponse } from "../schema/response";

const SearchUnavailableResponse = toApiErrorResponse(["SearchUnavailable"]);
const InvalidSearchResponse = toApiErrorResponse(["InvalidSearch"]);

export default new Elysia({ prefix: "/search" })
	.post(
		"",
		async ({ body }) => {
			try {
				return await searchGrouped({
					...body,
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
		async ({ params, body }) => {
			try {
				return await searchDomain(params.index, body);
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
