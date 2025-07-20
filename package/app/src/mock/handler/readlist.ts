import { http, HttpResponse } from "msw";
import { readlistRouter } from "contract/module/readList";
import { mockBookLists } from "../data/booklists";

export const readlistHandlers = [
    // List readlists
    http.get(readlistRouter.listByBook.path, ({ request }) => {
        const url = new URL(request.url);
        const page = Number(url.searchParams.get("page") ?? 1);
        const limit = Number(url.searchParams.get("limit") ?? 20);
        const start = (page - 1) * limit;
        const items = mockBookLists.slice(start, start + limit);
        return HttpResponse.json({
            items,
            page,
            totalPages: 1,
            total: mockBookLists.length,
        });
    }),

    // Get single readlist
    http.get(readlistRouter.get.path, ({ params }) => {
        const list = mockBookLists.find((l) => String(l.id) === (params as any)["id"]);
        if (!list) return HttpResponse.json({ message: "Not found" }, { status: 404 });
        return HttpResponse.json(list);
    }),

    // Create readlist
    http.post(readlistRouter.create.path, async ({ request }) => {
        const body = await request.json();
        const newList = {
            id: String(mockBookLists.length + 1),
            ...(body as any),
            creator: {
                name: "Mock User",
                avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=user",
            },
            likes: 0,
        } as any;
        mockBookLists.push(newList);
        return HttpResponse.json(newList, { status: 201 });
    }),
]; 