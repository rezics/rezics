import { http, HttpResponse } from "msw";

export const homepageHandlers = [
    // ANCHOR 🟢 REST: GET /home/delay (converted from HomeDelayQuery)
    http.get("/home/delay", async () => {
        await new Promise((resolve) => setTimeout(resolve, 10000));
        await new Promise((resolve) => setTimeout(resolve, 10000));
        return HttpResponse.json({
            book: {
                id: "1",
            },
        });
    }),
];
