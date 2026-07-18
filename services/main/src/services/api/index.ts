import { cors } from "@elysiajs/cors";
import { JsonValue } from "@rezics/portable-text";
import Elysia from "elysia";

import catalog from "./catalog";
import collections from "./collections";
import realms from "./realms";
import contentStructure from "./content-structure";
import posts from "./posts";
import health from "./health";
import history from "./history";
import messages from "./messages";
import notifications from "./notifications";
import recommendations from "./recommendations";
import feed from "./feed";
import feedback from "./feedback";
import governance from "./governance";
import domainExtensions from "./domain-extensions";
import polls from "./polls";
import progress from "./progress";
import reactions from "./reactions";
import reviews from "./reviews";
import search from "./search";
import tokens from "./tokens";
import uploads from "./uploads";
import users from "./users";
import units from "./units";
import { auth } from "../auth";
import { env } from "../config";
import {
	ApiErrorRegistry,
	toApiErrorBody,
	InternalError,
	isApiError,
	ValidationError,
} from "./errors";

export default new Elysia()
	.model({ JsonValue })
	.error(ApiErrorRegistry)
	.use(
		cors({
			origin: env.BETTER_AUTH_TRUSTED_ORIGINS,
			credentials: true,
			methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization", "Accept-Language"],
		}),
	)
	.onError(({ error, code, request, set, status }) => {
		const requestId = crypto.randomUUID();
		if (isApiError(error)) {
			if (error._tag === "ApiTokenRateLimitExceeded")
				set.headers["Retry-After"] = String(error.retryAfterSeconds);
			return status(error.status, toApiErrorBody(error, requestId));
		}
		if (code === "VALIDATION") {
			const validationError = new ValidationError();
			return status(validationError.status, toApiErrorBody(validationError, requestId));
		}
		console.error("Request failed", {
			requestId,
			method: request.method,
			url: request.url,
			error,
		});
		const internalError = new InternalError(error);
		return status(internalError.status, toApiErrorBody(internalError, requestId));
	})
	.mount(auth.handler)
	.group("/api", (api) =>
		api.guard({ parse: "json" }, (api) =>
			api
				.use(health)
				.use(notifications)
				.use(recommendations)
				.use(messages)
				.use(tokens)
				.use(feed)
				.use(feedback)
				.use(governance)
				.use(domainExtensions)
				.use(users)
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
				.use(search)
				.use(uploads),
		),
	);
