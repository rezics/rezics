import { cors } from "@elysiajs/cors";
import { JsonValue } from "@rezics/portable-text";
import { getActiveObservability } from "@rezics/observability";
import { createElysiaObservability } from "@rezics/observability/elysia";
import Elysia from "elysia";

import catalog from "./catalog";
import associationProposals from "./association-proposals";
import collections from "./collections";
import realms from "./realms";
import realmNavigation from "./realm-navigation";
import contentStructure from "./content-structure";
import posts from "./posts";
import health from "./health";
import history from "./history";
import imageAssetContent from "./image-assets/content";
import imageAssets from "./image-assets";
import messages from "./messages";
import notifications from "./notifications";
import recommendations from "./recommendations";
import feed from "./feed";
import feedback from "./feedback";
import governance from "./governance";
import domainExtensions from "./domain-extensions";
import docks from "./docks";
import polls from "./polls";
import progress from "./progress";
import reactions from "./reactions";
import reviews from "./reviews";
import search from "./search";
import slugAddresses from "./slug-addresses";
import staff from "./staff";
import tags from "./tags";
import tokens from "./tokens";
import tokenInfo from "./token-info";
import tokenPolicies from "./token-policies";
import users from "./users";
import units from "./units";
import { auth } from "../auth";
import { env } from "../config";
import {
	ApiErrorRegistry,
	toApiErrorBody,
	InternalError,
	isApiError,
	MalformedRequestBody,
	ValidationError,
} from "./errors";
import { toUnitVariantConstraintError } from "../units/variants";
import { toPostTargetingConstraintError } from "../posts/targeting";
import { toTagStructureConstraintError } from "../tag-structures/service";

const { logger } = getActiveObservability();

export default new Elysia()
	.use(createElysiaObservability())
	.model({ JsonValue })
	.parser("empty-body", ({ request }) => {
		// A null Fetch body proves there is nothing for the following JSON parser to consume.
		return request.body === null ? null : undefined;
	})
	.error(ApiErrorRegistry)
	.use(
		cors({
			origin: env.BETTER_AUTH_TRUSTED_ORIGINS,
			credentials: true,
			methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization", "Accept-Language"],
		}),
	)
	.onError(({ error, code, request, route, set, status }) => {
		const requestId = crypto.randomUUID();
		if (isApiError(error)) {
			if (error._tag === "ApiTokenRateLimitExceeded")
				set.headers["Retry-After"] = String(error.retryAfterSeconds);
			return status(error.status, toApiErrorBody(error, requestId));
		}
		const variantConstraintError = toUnitVariantConstraintError(error);
		if (variantConstraintError)
			return status(
				variantConstraintError.status,
				toApiErrorBody(variantConstraintError, requestId),
			);
		const postTargetingConstraintError = toPostTargetingConstraintError(error);
		if (postTargetingConstraintError)
			return status(
				postTargetingConstraintError.status,
				toApiErrorBody(postTargetingConstraintError, requestId),
			);
		const tagStructureConstraintError = toTagStructureConstraintError(error);
		if (tagStructureConstraintError)
			return status(
				tagStructureConstraintError.status,
				toApiErrorBody(tagStructureConstraintError, requestId),
			);
		if (code === "PARSE") {
			const malformedRequestBody = new MalformedRequestBody();
			return status(
				malformedRequestBody.status,
				toApiErrorBody(malformedRequestBody, requestId),
			);
		}
		if (code === "VALIDATION") {
			const validationError = new ValidationError();
			return status(validationError.status, toApiErrorBody(validationError, requestId));
		}
		logger.error("Request failed", {
			eventName: "http.request.failed",
			errorCode: "InternalError",
			request: { method: request.method, route: route || "unmatched" },
			error,
			attributes: { requestId },
		});
		const internalError = new InternalError(error);
		return status(internalError.status, toApiErrorBody(internalError, requestId));
	})
	.mount(auth.handler)
	.use(imageAssetContent)
	.group("/api", (api) =>
		api.guard({ parse: ["empty-body", "json"] }, (api) =>
			api
				.use(associationProposals)
				.use(health)
				.use(notifications)
				.use(recommendations)
				.use(messages)
				.use(tokens)
				.use(tokenInfo)
				.use(tokenPolicies)
				.use(feed)
				.use(feedback)
				.use(governance)
				.use(domainExtensions)
				.use(docks)
				.use(users)
				.use(staff)
				.use(tags)
				.use(slugAddresses)
				.use(units)
				.use(history)
				.use(catalog)
				.use(contentStructure)
				.use(progress)
				.use(collections)
				.use(reviews)
				.use(reactions)
				.use(polls)
				.use(posts)
				.use(realms)
				.use(realmNavigation)
				.use(search)
				.use(imageAssets),
		),
	);
