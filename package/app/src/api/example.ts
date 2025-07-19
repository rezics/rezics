import { ts_rest, ts_query } from "contract";
import { z } from "zod";

const contract = ts_rest.initContract();

const router = contract.router({
    example: {
        method: "GET",
        path: "/example",
        query: z.object({
            name: z.string().describe("Name to greet"),
        }),
        responses: {
            200: z.object({
                message: z.string().describe("An example response"),
            }),
        },
    },
});

export const tsr = ts_query.initTsrReactQuery(router, {
    baseUrl: "http://localhost:3333",
    baseHeaders: {
        "x-app-source": "ts-rest",
    },
});

tsr.example.query({
    query: {
        name: "World",
    },
});
