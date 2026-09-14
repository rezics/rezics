import { cors } from "@elysia/cors";
import { createElysiaObservability } from "@rezics/observability/elysia";
import Elysia from "elysia";

import { enterAuditRequestContext } from "../audit";
import { auth } from "../auth";
import session from "../auth/session";
import { env } from "../config";
import agentGuide from "./agent-guide";
import accessManagement from "./access";
import associationProposals from "./association-proposals";
import audit from "./audit";
import collections from "./collections";
import catalog from "./catalog";
import contentStructure from "./content-structure";
import customThemes from "./custom-themes";
import docks from "./docks";
import domainExtensions from "./domain-extensions";
import errorBoundary from "./error-boundary";
import feed from "./feed";
import favorites from "./favorites";
import governance from "./governance";
import health from "./health";
import history from "./history";
import imageAssets from "./image-assets";
import imageAssetContent from "./image-assets/content";
import messages from "./messages";
import notifications from "./notifications";
import participation from "./participation";
import platformAccess from "./platform-access";
import platformUsers from "./platform-users";
import polls from "./polls";
import posts from "./posts";
import progress from "./progress";
import quotaPolicies from "./quota-policies";
import reactions from "./reactions";
import realms from "./realms";
import recommendations from "./recommendations";
import reports from "./reports";
import reviews from "./reviews";
import search from "./search";
import slugAddresses from "./slug-addresses";
import tags from "./tags";
import tokenInfo from "./token-info";
import tokens from "./tokens";
import unitPresentations from "./unit-presentations";
import unitResources from "./unit-resources";
import units from "./units";
import users from "./users";
import wikiNavigation from "./wiki-navigation";

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
			allowedHeaders: [
				"Content-Type",
				"Authorization",
				"Accept-Language",
				"X-Rezics-Participation",
				"X-Rezics-Authority",
			],
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
				.use(accessManagement)
				.use(associationProposals)
				.use(health)
				.use(notifications)
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
				.use(catalog)
				.use(docks)
				.use(users)
				.use(participation)
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
				.use(favorites)
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
