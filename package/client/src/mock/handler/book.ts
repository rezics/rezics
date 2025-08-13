import { http, HttpResponse } from "msw";
import { Book } from "contract";
import { Chapter } from "contract";
import { bookList01 } from "../data/bookList01.ts";
import { bookInfo01 } from "../data/bookinfo01.ts";
import chapterList01 from "../data/chapterlist01.json" with { type: "json" };
import { chapterContent01 } from "../data/chapterContent01.ts";
import { generateRandomItemsFrom } from "./common.ts";

const books = [...bookList01];

export const bookHandlers = [
    // List and Search books
    http.get(Book.list.path, ({ request }) => {
        const url = new URL(request.url);
        const searchParams = url.searchParams;
        const query = {
            page: searchParams.get("page"),
            limit: searchParams.get("limit"),
            type: searchParams.get("type"),
            order: searchParams.get("order"),
            tag: searchParams.get("tag"),
            sort: searchParams.get("sort"),
        };
        console.log("mock book list query", query);
        const responseJson = {
            items: generateRandomItemsFrom(books, Number(query.limit) || 5),
            page: query.page,
            totalItems: 10000,
        };
        return HttpResponse.json(responseJson);
    }),

    // Top books
    // http.get(Book.top.path, () => HttpResponse.json(books.slice(0, 5))),

    // Get book detail
    http.get(Book.get.path, ({ params }) => {
        // const book = books.find((b) => b.id === (params as any)["id"]) ?? (bookInfo01 as any);
        // if (!book) return HttpResponse.json({ message: "Not found" }, { status: 404 });
        const book = bookInfo01;
        return HttpResponse.json(book);
    }),

    // Update book
    http.put(Book.update.path, async ({ params, request }) => {
        const index = books.findIndex((b) => b.id === (params as any)["id"]);
        if (index === -1) {
            return HttpResponse.json({ message: "Not found" }, { status: 404 });
        }
        const patch: any = await request.json();
        books[index] = { ...(books[index] as any), ...(patch as any) };
        return HttpResponse.json(books[index]);
    }),

    // Chapters list
    http.get(Chapter.list.path, () => {
        let data: any = { chapters: [], order: [] };
        data.order = chapterList01.order;
        data.chapters = Object.values(chapterList01.chapters);
        // console.log("chapters", data);
        return HttpResponse.json(data);
    }),

    // Chapter content
    http.get(Chapter.get.path, ({ params }) => {
        return HttpResponse.json(chapterContent01);
        // return HttpResponse.json({
        //     id: (params as any)["chapterId"],
        //     content: "Mock chapter content",
        //     created_at: new Date().toISOString(),
        //     chapterName: `章节 ${(params as any)["chapterId"]}`,
        //     author: {
        //         id: "1",
        //         name: "Mock Author",
        //         avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=author",
        //     },
        // });
    }),
];
