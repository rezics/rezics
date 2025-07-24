import c from "./c";
import { z } from "zod";
import { QuoteExcerptSchema, BookReviewSchema } from "../schema/Review";

export default c.router({
    listReviews: {
        method: "GET",
        path: "/books/:bookId/reviews",
        responses: { 200: z.array(BookReviewSchema) },
    },
    listShortReviews: {
        method: "GET",
        path: "/books/:bookId/short-reviews",
        responses: { 200: z.array(BookReviewSchema) },
    },
    createReview: {
        method: "POST",
        path: "/books/:bookId/reviews",
        body: BookReviewSchema.omit({ id: true, createdAt: true, user: true }),
        responses: { 201: BookReviewSchema },
    },
    listQuotes: {
        method: "GET",
        path: "/books/:bookId/quotes",
        responses: { 200: z.array(QuoteExcerptSchema) },
    },
});
