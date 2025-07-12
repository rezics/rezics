import { http, HttpResponse } from "msw";
import { mockReviews, mockUsers as reviewUsers } from "../data/reviews";

export const bookReviewsHandlers = [
    // ANCHOR 🟢 REST: GET /books/:bookId/reviews
    http.get("/books/:bookId/reviews", ({ params }) => {
        const { bookId } = params;
        const reviews = mockReviews
            .filter((review) => review.bookId === bookId)
            .map((review) => ({
                ...review,
                user: reviewUsers.find((user) => user.id === review.userId),
            }));

        return HttpResponse.json(reviews);
    }),

    // ANCHOR 🟢 REST: POST /books/:bookId/reviews
    http.post("/books/:bookId/reviews", async ({ request, params }) => {
        const { bookId } = params;
        const { content, rating } = await request.json();

        const newReview = {
            id: `review_${Date.now()}`,
            content,
            rating,
            createdAt: new Date().toISOString(),
            user: {
                id: "user1",
                name: "John Doe",
                avatar: "https://via.placeholder.com/150",
            },
            bookId,
        };

        return HttpResponse.json(newReview);
    }),
];
