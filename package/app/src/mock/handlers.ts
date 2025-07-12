// src/mocks/handlers.ts
import { http, HttpResponse } from "msw";
import { handlers as apiHandlers } from "./handler";

export const handlers = [
    ...apiHandlers,
    // ANCHOR ⚠️ fallback handler - 捕捉未拦截的请求
    http.all("*", (req) => {
        console.warn(`[MSW] ⚠️ Unhandled REST request: ${req.request.method} ${req.request.url}`);
        return HttpResponse.json(
            { message: `No mock handler for: ${req.request.method} ${req.request.url}` },
            { status: 404 },
        );
    }),
];
