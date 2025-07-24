import { http, HttpResponse } from "msw";
import { Homepage } from "contract";

export const homePageHandlers = [
    http.get(Homepage.get.path, () => {
        return HttpResponse.json({
            id: "1",
            content: "Mock Home Page",
        });
    }),
];
