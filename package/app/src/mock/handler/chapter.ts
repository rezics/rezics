import { graphql, HttpResponse } from "msw";

import { chapterContent01 } from "../data/chapterContent01";

export const chapterHandlers = [
    // ANCHOR 🟢 Query: GetChapterContent
    graphql.query("ChapterContentQuery", ({ variables }) => {
        let chapterContent = chapterContent01;
        chapterContent.content = chapterContent01.content.repeat(100);
        chapterContent.content += "\n\n\n\n\n" 
        chapterContent.content = chapterContent.content.repeat(10);

        return HttpResponse.json({
            data: chapterContent
        });
    }),

    // // ANCHOR 🟢 Mutation: AddBook
    // graphql.mutation("AddBookDocument", async ({ variables }) => {
    //     const { title, author } = variables;

    //     return HttpResponse.json({
    //         data: {
    //             addBook: {
    //                 id: String(Math.floor(Math.random() * 10000)),
    //                 title,
    //                 author,
    //             },
    //         },
    //     });
    // }),
] 