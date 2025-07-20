import { http, HttpResponse } from "msw";
import { reviewRouter } from "contract/module/review";
import { mockReviews, mockUsers, mockBookShortReviews } from "../data/reviews";
import { mockQuotes } from "../data/mockQuotes";

export const reviewHandlers = [
    // List full reviews
    http.get(reviewRouter.listReviews.path, ({ params }) => {
        const reviews = mockReviews
            // .filter((r) => r.bookId === (params as any)["id"])
            .filter(() => 1)
            .map((r) => {
                const user = mockUsers.find((u) => u.id === r.userId);
                return {
                    id: r.id,
                    title: `Review ${r.id}`,
                    content: r.content,
                    rating: r.rating,
                    createdAt: r.createdAt,
                    user: user
                        ? { id: user.id, name: user.name, avatar: user.avatar }
                        : { id: "0", name: "Unknown", avatar: "" },
                };
            });
        return HttpResponse.json(reviews);
    }),

    // List short reviews
    http.get(reviewRouter.listShortReviews.path, () => HttpResponse.json(mockBookShortReviews)),

    // Create review
    http.post(reviewRouter.createReview.path, async ({ request, params }) => {
        const body = await request.json();
        const newReviewId = String(mockReviews.length + 1);
        const newReview = {
            id: newReviewId,
            bookId: (params as any)["id"],
            content: (body as any).content ?? "",
            rating: (body as any).rating ?? 0,
            createdAt: new Date().toISOString(),
            userId: "1",
        } as any;
        mockReviews.push(newReview);
        return HttpResponse.json(
            {
                id: newReview.id,
                title: (body as any).title ?? "",
                content: newReview.content,
                rating: newReview.rating,
                createdAt: newReview.createdAt,
                user: { id: "1", name: "John Doe", avatar: "" },
            },
            { status: 201 },
        );
    }),

    // Quotes
    http.get(reviewRouter.listQuotes.path, () => HttpResponse.json(mockQuotes)),
]; 