import { cors } from "@elysia/cors";
import { createElysiaObservability } from "@rezics/observability/elysia";
import Elysia from "elysia";

import { enterAuditRequestContext } from "../audit";
import unitResources from "./unit-resources";
import associationProposals from "./association-proposals";
import audit from "./audit";
import collections from "./collections";
import realms from "./realms";
import wikiNavigation from "./wiki-navigation";
import contentStructure from "./content-structure";
import posts from "./posts";
import health from "./health";
import agentGuide from "./agent-guide";
import history from "./history";
import imageAssetContent from "./image-assets/content";
import imageAssets from "./image-assets";
import messages from "./messages";
import notifications from "./notifications";
import ownershipClaims from "./ownership-claims";
import recommendations from "./recommendations";
import feed from "./feed";
import reports from "./reports";
import governance from "./governance";
import domainExtensions from "./domain-extensions";
import docks from "./docks";
import polls from "./polls";
import progress from "./progress";
import reactions from "./reactions";
import reviews from "./reviews";
import search from "./search";
import slugAddresses from "./slug-addresses";
import platformAccess from "./platform-access";
import platformUsers from "./platform-users";
import tags from "./tags";
import tokens from "./tokens";
import tokenInfo from "./token-info";
import quotaPolicies from "./quota-policies";
import users from "./users";
import customThemes from "./custom-themes";
import unitPresentations from "./unit-presentations";
import units from "./units";
import { auth } from "../auth";
import session from "../auth/session";
import { env } from "../config";
import errorBoundary from "./error-boundary";

export default new Elysia()
	.use(createElysiaObservability())
	.parser("empty-body", ({ request }) => {
		// A null Fetch body proves there is nothing for the following JSON parser to consume.
		return request.body === null ? null : undefined;
	})
	.use(
		cors({
			origin: env.BETTER_AUTH_TRUSTED_ORIGINS,
			credentials: true,
			methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization", "Accept-Language"],
			exposeHeaders: ["X-Request-Id", "Retry-After"],
		}),
	)
	.request(({ set }) => {
		const requestId = crypto.randomUUID();
		enterAuditRequestContext({ requestId });
		set.headers["X-Request-Id"] = requestId;
	})
	.use(errorBoundary)
	.mount(auth.handler)
	.use(session)
	.use(agentGuide)
	.use(imageAssetContent)
	.group("/api/v1", (api) =>
		api.guard({ parse: ["empty-body", "json"] }, (api) =>
			api
				.use(associationProposals)
				.use(health)
				.use(notifications)
				.use(ownershipClaims)
				.use(recommendations)
				.use(messages)
				.use(tokens)
				.use(tokenInfo)
				.use(quotaPolicies)
				.use(feed)
				.use(reports)
				.use(governance)
				.use(audit)
				.use(domainExtensions)
				.use(docks)
				.use(users)
				.use(customThemes)
				.use(unitPresentations)
				.use(platformAccess)
				.use(platformUsers)
				.use(tags)
				.use(slugAddresses)
				.use(units)
				.use(history)
				.use(unitResources)
				.use(contentStructure)
				.use(progress)
				.use(collections)
				.use(reviews)
				.use(reactions)
				.use(polls)
				.use(posts)
				.use(realms)
				.use(wikiNavigation)
				.use(search)
				.use(imageAssets),
		),
	);
