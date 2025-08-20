import { HttpResponse } from "msw";
import { mockQuotes } from "../data/mockQuotes.ts";
import { mockBookShortReviews, mockReviews, mockUsers } from "../data/reviews.ts";
import { generateRandomItemsFrom } from "./common.ts";

function genId() {
    return Math.random().toString(36).slice(2, 10);
}

// operation: "review.short.list"
export function reviewShortListHandler(body: any) {
    const limit = body?.parameter?.limit;
    const list = Array.isArray(mockBookShortReviews)
        ? (limit ? mockBookShortReviews.slice(0, limit) : mockBookShortReviews)
        : [];
    return HttpResponse.json(list, { status: 200 });
}

// operation: "review.list"
export function reviewListHandler(body: any) {
    const limit = body?.parameter?.limit;
    const bookId = body?.parameter?.bookId;
    const source = Array.isArray(mockReviews) ? mockReviews : [];
    const filtered = bookId
        ? source.filter((r: any) => r.bookId === bookId)
        : source;
    const joined = filtered.map((r: any) => ({
        ...r,
        user: mockUsers.find((u) => u.id === r.userId)
            ?? { id: String(r.userId ?? ""), name: "Unknown", avatar: "" },
    }));
    const list = limit ? joined.slice(0, limit) : joined;
    const result = generateRandomItemsFrom(list, 4);
    return HttpResponse.json(result, { status: 200 });
}

// operation: "review.create"
export function reviewCreateHandler(body: any) {
    const id = genId();
    const user = mockUsers[0] ?? { id: "1", name: "John Doe", avatar: "" };
    const created = {
        id,
        title: body?.parameter?.title ?? "",
        content: body?.parameter?.content ?? "",
        rating: body?.parameter?.rating ?? 0,
        created_at: new Date().toISOString(),
        user,
    } as any;
    mockReviews.push({
        id,
        bookId: body?.parameter?.bookId ?? "1",
        content: created.content,
        rating: created.rating,
        created_at: created.created_at,
        userId: user.id,
    } as any);
    return HttpResponse.json({ ...created }, { status: 201 });
}

// operation: "review.listQuotes"
export function reviewListQuotesHandler(body: any) {
    const limit = Number(body?.parameter?.limit) || 5;
    const items = generateRandomItemsFrom(mockQuotes, limit);
    return HttpResponse.json(items, { status: 200 });
}
