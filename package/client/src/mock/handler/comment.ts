import { HttpResponse } from "msw";

// Minimal tree data placeholder
const mockCommentTree01 = {
    id: "root",
    content: "Root comment",
    author: { id: "1", name: "User 1" },
    replies: [
        {
            id: "c1",
            content: "First reply",
            author: { id: "2", name: "User 2" },
            replies: [],
        },
    ],
};

// In-memory store
const commentStore = new Map<string, any>([[mockCommentTree01.id, mockCommentTree01]]);

function genId() {
    return Math.random().toString(36).slice(2, 10);
}

export function commentCreateHandler(body: any) {
    const id = genId();
    const created = {
        id,
        content: body?.parameter?.content ?? "",
        author: body?.parameter?.author ?? { id: "0", name: "Anonymous" },
        replies: [],
    };
    commentStore.set(id, created);
    return HttpResponse.json({ id: created.id }, { status: 200 });
}

export function commentReadHandler(body: any) {
    const id = body?.parameter?.id ?? mockCommentTree01.id;
    const found = commentStore.get(id) ?? mockCommentTree01;
    const result = { id: found.id, content: found.content };
    return HttpResponse.json({ ...result }, { status: 200 });
}

export function commentUpdateHandler(body: any) {
    const id = body?.parameter?.id;
    const prev = id ? commentStore.get(id) : undefined;
    if (!prev) {
        const created = {
            id: id ?? genId(),
            content: body?.parameter?.content ?? "",
            author: body?.parameter?.author ?? { id: "0", name: "Anonymous" },
            replies: [],
        };
        commentStore.set(created.id, created);
        return HttpResponse.json({ id: created.id }, { status: 200 });
    }
    const updated = {
        ...prev,
        ...body?.parameter,
    };
    commentStore.set(updated.id, updated);
    return HttpResponse.json({ id: updated.id }, { status: 200 });
}

export function commentDeleteHandler(body: any) {
    const id = body?.parameter?.id;
    if (id) commentStore.delete(id);
    return HttpResponse.json({ id }, { status: 200 });
}

// For listing comments under an entity (custom op if not in contract)
export function commentListByTargetHandler(body: any) {
    const _targetId = body?.parameter?.targetId ?? "root";
    // For mock, just return the root tree regardless
    return HttpResponse.json({ ...mockCommentTree01 }, { status: 200 });
}

export const commentHandlers = [];
