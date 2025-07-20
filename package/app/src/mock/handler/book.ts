import { http, HttpResponse } from "msw";
import { bookRouter } from "contract";
import { bookList01 } from "../data/bookList01";
import { bookInfo01 } from "../data/bookinfo01";
import chapterList01 from "../data/chapterlist01.json";
import { chapterContent01 } from "../data/chapterContent01";

const books = [...bookList01];

export const bookHandlers = [
    // List books with pagination
    http.get(bookRouter.list.path, ({ request }) => {
        const url = new URL(request.url);
        const page = Number(url.searchParams.get("page") ?? 1);
        const limit = Number(url.searchParams.get("limit") ?? 20);
        const start = (page - 1) * limit;
        const items = books.slice(start, start + limit);
        return HttpResponse.json({
            items,
            page,
            totalPages: 1,
            total: books.length,
        });
    }),

    // Search books
    http.get(bookRouter.search.path, ({ request }) => {
        const url = new URL(request.url);
        const query = (url.searchParams.get("query") ?? "").toLowerCase();
        const filtered = books.filter((b) => b.title.toLowerCase().includes(query));
        return HttpResponse.json({
            items: filtered,
            page: 1,
            totalPages: 1,
            total: filtered.length,
        });
    }),

    // Top books
    http.get(bookRouter.top.path, () => HttpResponse.json(books.slice(0, 5)) ),

    // Get book detail
    http.get(bookRouter.get.path, ({ params }) => {
        // const book = books.find((b) => b.id === (params as any)["id"]) ?? (bookInfo01 as any);
        // if (!book) return HttpResponse.json({ message: "Not found" }, { status: 404 });
        const book = bookInfo01;
        return HttpResponse.json(book);
    }),

    // Update book
    http.put(bookRouter.update.path, async ({ params, request }) => {
        const index = books.findIndex((b) => b.id === (params as any)["id"]);
        if (index === -1) return HttpResponse.json({ message: "Not found" }, { status: 404 });
        const patch: any = await request.json();
        books[index] = { ...(books[index] as any), ...(patch as any) };
        return HttpResponse.json(books[index]);
    }),

    // Chapters list
    http.get(bookRouter.chapters.list.path, () => {
        let data: any = {chapters:[], order: []}
        data.order = chapterList01.order
        data.chapters = Object.values(chapterList01.chapters);
        // console.log("chapters", data);
        return HttpResponse.json(data);
    }),

    // Chapter content
    http.get(bookRouter.chapters.content.path, ({ params }) => {
        return HttpResponse.json(chapterContent01);
        // return HttpResponse.json({
        //     id: (params as any)["chapterId"],
        //     content: "Mock chapter content",
        //     createdAt: new Date().toISOString(),
        //     chapterName: `章节 ${(params as any)["chapterId"]}`,
        //     author: {
        //         id: "1",
        //         name: "Mock Author",
        //         avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=author",
        //     },
        // });
    }),
]; 