import { graphql, HttpResponse } from "msw";
import type { HandlerResolver } from "./types";
import { mockComment01 } from "../data/comment01"; // Adjusted path
import { mockUsers } from "../data/auth"; // For creator of new comment/reply

// Assuming mockComments is a more general list, similar to how mockComment01 was used.
// You might need to create or adjust this.
let mockComments: any[] = [...mockComment01]; // Initializing with mockComment01 if it's the base

export const commentHandlers = [
    // 🟢 Query: GetComments
    graphql.query("GetComments", (({ variables }) => {
        const { bookListId } = variables as { bookListId?: string }; // Type assertion
        // Original logic returned mockComment01 directly. If filtering is needed:
        // const commentsForList = mockComments.filter(c => c.bookListId === bookListId);
        // return HttpResponse.json({ data: { comments: commentsForList } });
        return HttpResponse.json({
            data: {
                comments: mockComment01, // Replicating original behavior
            },
        });
    }) as HandlerResolver),

    // 🟢 Mutation: AddComment
    graphql.mutation("AddComment", (({ variables }) => {
        const { bookListId, content } = variables as { bookListId?: string; content?: string };
        const newComment = {
            id: `comment-${Date.now()}`,
            bookListId,
            content,
            createdAt: new Date().toISOString(),
            user: mockUsers[0], // Placeholder for comment creator
            likes: 0,
            replies: [],
        };
        mockComments.push(newComment);
        return HttpResponse.json({ data: { addComment: newComment } });
    }) as HandlerResolver),

    // 🟢 Mutation: AddReply
    graphql.mutation("AddReply", (({ variables }) => {
        const { commentId, content } = variables as { commentId?: string; content?: string };
        const parentComment = mockComments.find((c) => c.id === commentId);
        if (!parentComment) {
            return HttpResponse.json({ errors: [{ message: "Comment not found" }] }, { status: 404 });
        }

        const newReply = {
            id: `reply-${Date.now()}`,
            content,
            createdAt: new Date().toISOString(),
            user: mockUsers[0], // Placeholder for reply creator
            likes: 0,
            replies: [], // Replies to replies are not handled in this basic version
        };

        parentComment.replies = parentComment.replies || []; // Ensure replies array exists
        parentComment.replies.push(newReply);
        return HttpResponse.json({ data: { addReply: newReply } });
    }) as HandlerResolver),
];
