import { http, HttpResponse } from "msw";
import { postRouter } from "contract";

const categories = [
    { id: "1", title: "General" },
    { id: "2", title: "News" },
];

let posts = [
    {
        id: "1",
        title: "Post 1",
        content: "Content 1",
        category: categories[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: "2",
        title: "Post 2",
        content: "Content 2",
        category: categories[1],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
];

export const postHandlers = [
    // List posts
    http.get(postRouter.list.path, ({ request }) => {
        const url = new URL(request.url);
        const page = Number(url.searchParams.get("page") ?? 1);
        const limit = Number(url.searchParams.get("limit") ?? 20);
        const start = (page - 1) * limit;
        const items = posts.slice(start, start + limit);
        return HttpResponse.json({
            items,
            page,
            totalPages: 1,
            total: posts.length,
        });
    }),

    // Get post
    http.get(postRouter.get.path, ({ params }) => {
        const post = posts.find((p) => p.id === (params as any)["id"]);
        if (!post) return HttpResponse.json({ message: "Not found" }, { status: 404 });
        return HttpResponse.json(post);
    }),

    // Create post
    http.post(postRouter.create.path, async ({ request }) => {
        const body = await request.json();
        const newPost = {
            id: String(posts.length + 1),
            ...(body as any),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        } as any;
        posts.push(newPost);
        return HttpResponse.json(newPost, { status: 201 });
    }),

    // Update post
    http.put(postRouter.update.path, async ({ params, request }) => {
        const index = posts.findIndex((p) => p.id === (params as any)["id"]);
        if (index === -1) return HttpResponse.json({ message: "Not found" }, { status: 404 });
        const patch = await request.json();
        posts[index] = { ...(posts[index] as any), ...(patch as any), updatedAt: new Date().toISOString() };
        return HttpResponse.json(posts[index]);
    }),

    // Categories
    // http.get(postRouter.categories.path, () => HttpResponse.json(categories)),
]; 