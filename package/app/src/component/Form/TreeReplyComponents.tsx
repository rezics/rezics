// 暂时就先这样不处理，后面树化，或者使用VirtualList

import React, { useState } from "react";
import { useQuery } from "urql";
import { GET_COMMENTS } from "@/graphql/bookList";
import { Avatar, Box, Collapse, IconButton, Typography } from "@mui/material";
import { Add, Remove } from "@mui/icons-material";
import { ReactionBar } from "../Common/ReactionBar";

// This is a temporary type definition based on the GraphQL schema.
// It should be replaced with generated types.
type Author = {
    name: string;
    avatar: string;
};

type Comment = {
    id: string;
    content: string;
    createdAt: string;
    author: Author;
    likes: number;
    replies?: Comment[];
};

interface CommentNodeProps {
    comment: Comment;
    level?: number;
}

const CommentNode: React.FC<CommentNodeProps> = ({ comment, level = 0 }) => {
    // Expand first two levels by default
    const [isExpanded, setIsExpanded] = useState(level < 2);

    const handleToggleExpand = () => {
        if (comment.replies && comment.replies.length > 0) {
            setIsExpanded(!isExpanded);
        }
        // TODO: Implement asynchronous loading of comments if they are not already fetched.
        // This would require a new GraphQL query like `getReplies(commentId: ID!)`.
    };

    const handleReply = () => {
        console.log("Replying to comment:", comment.id);
        // This is where you would trigger a reply dialog or an inline reply form.
    };

    return (
        <Box
            mt={2}
            pl={level > 0 ? 4 : 0}
            sx={{
                borderLeft: level > 0 ? `2px solid #eee` : "none",
                marginLeft: level > 0 ? "16px" : "0",
                paddingLeft: level > 0 ? "16px" : "0",
            }}
        >
            <Box display="flex" gap={2} alignItems="flex-start">
                <Avatar src={comment.author.avatar} sx={{ width: 32, height: 32 }} />
                <Box flex={1}>
                    <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="subtitle2" component="span" color="text.primary" fontWeight="bold">
                            {comment.author.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {new Date(comment.createdAt).toLocaleString()}
                        </Typography>
                    </Box>
                    <Typography variant="body2" mt={1}>
                        {comment.content}
                    </Typography>
                    <Box className="w-full flex justify-end">
                        <Box sx={{ width: { xs: "75%", sm: "50%", md: "33%", lg: "30%", xl: "30%" } }}>
                            <ReactionBar onReply={handleReply} className="mt-2" size="small" fontSize="1.3rem" />
                        </Box>
                    </Box>
                </Box>
                {comment.replies && comment.replies.length > 0 && (
                    <IconButton onClick={handleToggleExpand} size="small">
                        {isExpanded ? <Remove /> : <Add />}
                    </IconButton>
                )}
            </Box>

            {comment.replies && comment.replies.length > 0 && (
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    {comment.replies.map((reply) => (
                        <CommentNode key={reply.id} comment={reply} level={level + 1} />
                    ))}
                </Collapse>
            )}
        </Box>
    );
};

interface ReplyComponentsProps {
    bookListId: string;
}

export const TreeReplyComponents: React.FC<ReplyComponentsProps> = ({ bookListId }) => {
    const [{ data, fetching, error }] = useQuery({
        query: GET_COMMENTS,
        variables: { bookListId },
    });

    if (fetching) return <p>Loading...</p>;
    if (error) return <p>Oh no... {error.message}</p>;

    const topLevelComments = data?.comments || [];

    return (
        <Box p={2}>
            {topLevelComments.map((comment: Comment) => (
                <CommentNode key={comment.id} comment={comment} />
            ))}
        </Box>
    );
};

export default TreeReplyComponents;
