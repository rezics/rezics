import { graphql, HttpResponse } from "msw";

export const homepageHandlers = [
    // ANCHOR 🟢 Query: HomeDelayQuery
    graphql.query("HomeDelayQuery", async ({ variables }) => {
        await new Promise((resolve) => setTimeout(resolve, 10000));
        await new Promise((resolve) => setTimeout(resolve, 10000));
        return HttpResponse.json({
            data: {
                book: {
                    id: "1",
                },
            },
        });
    }),
];
