import { graphql, HttpResponse } from "msw";
import type { HandlerResolver } from "./types";
import { mockReviews, mockUsers as reviewUsers } from "../data/reviews"; // Adjusted path
import { mockUsers } from "../data/auth"; // For creator of new review

export const reviewHandlers = [
  // 🟢 Query: GetBookReviews
  graphql.query("GetBookReviews", (({ variables }) => {
    const { bookId } = variables as { bookId?: string }; // Type assertion
    const reviews = mockReviews
      .filter((review) => review.bookId === bookId)
      .map((review) => ({
        ...review,
        // Ensure reviewUsers has the correct type for find
        user: (reviewUsers as Array<{id: string}>).find((user) => user.id === review.userId),
      }));

    return HttpResponse.json({
      data: {
        bookReviews: reviews,
      },
    });
  }) as HandlerResolver),

  // 🟢 Mutation: AddReview
  graphql.mutation('AddReview', (({ variables }) => {
    const { bookId, content, rating } = variables as { bookId?: string, content?: string, rating?: number };
    const newReview = {
      id: `review-${Date.now()}`,
      bookId: bookId || "unknown-book", // Provide a fallback for bookId
      content: content || "",
      rating: rating || 0,
      createdAt: new Date().toISOString(),
      // Assuming mockUsers is for the generic user pool and reviewUsers is specific to review context
      // Using mockUsers[0] as a placeholder for the review creator
      user: mockUsers[0], 
      userId: mockUsers[0].id // Add userId to match the GetBookReviews mapping
    };
    // Add to the correct mockReviews array. Ensure it expects this structure.
    (mockReviews as Array<any>).push(newReview); 
    return HttpResponse.json({ data: { addReview: newReview } });
  }) as HandlerResolver),
]; 