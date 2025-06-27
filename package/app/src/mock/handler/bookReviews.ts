import { graphql, HttpResponse } from "msw";
import { mockReviews, mockUsers as reviewUsers } from "../data/reviews";

export const bookReviewsHandlers = [
    // ANCHOR 🟢 Query: GetBookReviews
    graphql.query("GetBookReviews", ({ variables }) => {
        const { bookId } = variables;
        const reviews = mockReviews
            .filter((review) => review.bookId === bookId)
            .map((review) => ({
                ...review,
                user: reviewUsers.find((user) => user.id === review.userId),
            }));

        return HttpResponse.json({
            data: {
                bookReviews: reviews,
            },
        });
    }),
] 