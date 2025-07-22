import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { id as idSchema } from "./common";

// ------------------------------------------------------------------
// HomePage Type
// ------------------------------------------------------------------
export const HomePageSchema = z.object({
    id: idSchema,
    content: z.string(),
});
export type HomePage = z.infer<typeof HomePageSchema>;

// ANCHOR HomePageRouter
const c = initContract();
export const homePageRouter = c.router({
    get: {
        method: "GET",
        path: "/home",
        responses: { 200: HomePageSchema },
    },
});
