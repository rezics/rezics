// src/mocks/handlers.ts
import { http, HttpResponse } from "msw";
import { apiHandler } from "./handler/index.ts";

export const handlers = [
	apiHandler,
	// fallback handler - 捕捉未拦截的请求
	http.all("*", ({ request }) => {
		console.warn(
			`[MSW] ⚠️ Unhandled request: ${request.method} ${request.url}`,
		);
		// return HttpResponse.json(
		//     { message: `No mock handler for ${request.method} ${request.url}` },
		//     { status: 400 },
		// );
	}),
];
