import { graphql, HttpResponse } from "msw";
import { mockBookLists } from "../data/booklists";
import { mockCommentTree01 } from "../data/comment01";
import { mockABookList01 } from "../data/abooklist01";

export const bookListHandlers = [
    // ANCHOR BOOKLIST
    // ANCHOR 🟢 Query: bookListsQuery
    graphql.query("bookListsQuery", () => {
        return HttpResponse.json({
            data: {
                bookLists: mockBookLists,
            },
        });
    }),

    // ANCHOR 🟢 Query: GetBookList
    graphql.query("GetBookList", ({ variables }) => {
        const { id } = variables;

        // // Since mockABookList01 is a single object, we just need to check if the id matches
        // if (mockABookList01.id !== parseInt(id)) {
        //   return HttpResponse.json({
        //     data: {
        //       bookList: null
        //     }
        //   });
        // }

        return HttpResponse.json({
            data: { bookList: mockABookList01 },
        });
    }),

    // ANCHOR 🟢 Query: GetComments
    graphql.query("GetComments", ({ variables }) => {
        const { bookListId } = variables;
        return HttpResponse.json({
            data: {
                comments: mockCommentTree01,
            },
        });
    }),
];
