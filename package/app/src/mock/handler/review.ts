import { http, HttpResponse } from "msw";
import { Review } from "contract";
import { mockReviews, mockUsers, mockBookShortReviews } from "../data/reviews";
import { mockQuotes } from "../data/mockQuotes";
import { generateRandomItemsFrom } from "./common";

export const reviewHandlers = [
    // List full reviews
    http.get(Review.listReviews.path, ({ params }) => {
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
    http.get(Review.listShortReviews.path, () =>
        HttpResponse.json(mockBookShortReviews),
    ),

    // Create review
    http.post(Review.createReview.path, async ({ request, params }) => {
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
    http.get(Review.listQuotes.path, ({ request, params, cookies }) => {
        // console.log(request, params, cookies);
        const url = new URL(request.url);
        const searchParams = url.searchParams;
        const query = {
            bookId: params["bookId"],
            page: searchParams.get("page"),
            limit: searchParams.get("limit"),
            type: searchParams.get("type"),
            order: searchParams.get("order"),
        };
        console.log(query);
        return HttpResponse.json(
            generateRandomItemsFrom(mockQuotes, Number(query.limit) || 5),
        );
    }),
];
