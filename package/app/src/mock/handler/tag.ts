import { http, HttpResponse } from "msw";
import { tagRouter } from "contract";

const mockTagGroups = [
    { key: "genre", name: "Genre", tags: ["Fantasy", "Sci-fi", "Romance"] },
    { key: "status", name: "Status", tags: ["Ongoing", "Completed"] },
];

export const tagHandlers = [
    http.get(tagRouter.list.path, () => HttpResponse.json(mockTagGroups)),

    http.get(tagRouter.get.path, ({ params }) => {
        const group = mockTagGroups.find((g) => g.key === (params as any)["key"]);
        if (!group) return HttpResponse.json({ message: "Not found" }, { status: 404 });
        return HttpResponse.json(group);
    }),
]; 