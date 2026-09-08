import { http, HttpResponse } from "msw";
import type { GetApiRealmsStatus200, GetApiTagsStatus200 } from "@rezics/openapi-tanstack-query";

// Only network boundaries actually used by the initial component scenarios.
export const storyHandlers = [
	http.get("*/api/auth/get-session", () => HttpResponse.json(null)),
	http.get("*/api/v1/realms", () =>
		HttpResponse.json({ items: [] } satisfies GetApiRealmsStatus200),
	),
	http.get("*/api/v1/tags", () => HttpResponse.json({ items: [] } satisfies GetApiTagsStatus200)),
];
