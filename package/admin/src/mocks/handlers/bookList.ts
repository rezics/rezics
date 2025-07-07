import { graphql, HttpResponse } from "msw";
import type { HandlerResolver } from "./types";
import { mockBookLists } from "../data/booklists"; // Adjusted path
import { mockABookList01 } from "../data/abooklist01"; // Adjusted path

export const bookListHandlers = [
    // 🟢 Query: GetBookLists
    graphql.query("GetBookLists", (() => {
        return HttpResponse.json({
            data: {
                bookLists: mockBookLists,
            },
        });
    }) as HandlerResolver),

    // 🟢 Query: GetBookList
    graphql.query("GetBookList", (({ variables }) => {
        const { id } = variables as { id?: string }; // Type assertion
        // Original logic for GetBookList seemed to always return mockABookList01
        // If specific list finding is needed, adjust mockABookList01 or search mockBookLists
        // For now, replicating the behavior of returning a specific list if id matches, or the general one
        if (id && mockABookList01.id === parseInt(id)) {
            return HttpResponse.json({ data: { bookList: mockABookList01 } });
        }
        // Fallback if no specific ID match or if ID is not provided for mockABookList01
        // Or, if you want to find from mockBookLists:
        // const foundList = mockBookLists.find(list => list.id === id);
        // if (foundList) return HttpResponse.json({ data: { bookList: foundList } });

        return HttpResponse.json({ data: { bookList: mockABookList01 } }); // Default return
    }) as HandlerResolver),
];
