import { http, HttpResponse } from "msw";
import { homePageRouter } from "contract";

export const homePageHandlers = [
    http.get(homePageRouter.get.path, () => {
        return HttpResponse.json({
            id: "1",
            content: "Mock Home Page",
        });
    }),
];