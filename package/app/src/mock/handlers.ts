// src/mocks/handlers.ts
import { graphql, HttpResponse } from "msw";
import { handlers as apiHandlers } from "./handler";

export const handlers = [
    ...apiHandlers,
    // ANCHOR ⚠️ fallback handler - 捕捉未拦截的请求
    graphql.operation((req) => {
        console.warn(`[MSW] ⚠️ Unhandled GraphQL operation: ${req.operationName}`);
        return HttpResponse.json(
            { errors: [{ message: `No mock handler for operation: ${req.operationName}` }] },
            { status: 400 },
        );
    }),
];
