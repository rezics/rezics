import { graphql, HttpResponse } from "msw";
import type { HandlerResolver } from "./types";
// Assuming you have a mockBooks array, similar to mockReviews, etc.
// You might need to create/adjust this path and data structure.
// import { mockBooks } from "../data/books"; 

export const bookHandlers = [
  // 🟢 Query: GetBooks (Example structure)
  graphql.query("GetBooksDocument", (({ variables }) => {
    // If you had mockBooks similar to other mock data:
    // return HttpResponse.json({ data: { books: mockBooks } });
    
    // Fallback or placeholder if mockBooks is not set up yet:
    return HttpResponse.json({
      data: {
        books: [
          { id: "1", title: "Mock Book 1 from book.ts", author: "Author A" },
          { id: "2", title: "Mock Book 2 from book.ts", author: "Author B" },
        ],
      },
    });
  }) as HandlerResolver),

  // 🟢 Mutation: AddBook (Example structure)
  graphql.mutation("AddBookDocument", (async ({ variables }) => {
    const { title, author } = variables as { title?: string, author?: string }; // Type assertion

    // Logic to add to a mockBooks array would go here
    // For example:
    // const newBook = {
    //   id: String(mockBooks.length + 1),
    //   title,
    //   author,
    // };
    // mockBooks.push(newBook);
    // return HttpResponse.json({ data: { addBook: newBook } });

    // Fallback or placeholder:
    return HttpResponse.json({
      data: {
        addBook: {
          id: String(Math.floor(Math.random() * 10000)),
          title,
          author,
        },
      },
    });
  }) as HandlerResolver),
]; 