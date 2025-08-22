// 暂时就先这样不处理，后面树化，或者使用VirtualList

import { Add, Remove } from "@mui/icons-material";
import {
	Avatar,
	Box,
	Button,
	Collapse,
	IconButton,
	Typography,
} from "@mui/material";
import React, { useCallback, useEffect, useMemo, useState } from "react";
//  ;
import { apiPost } from "@/api/swr.ts";
import { useDialogStore } from "@/global/dialogStore.ts";
import useSWR from "swr";
import { ReactionBar } from "../Common/ReactionBar.tsx";
import { ReplyDrawer } from "./ReplyDrawer.tsx";

// This is a temporary type definition based on the GraphQL schema.
// It should be replaced with generated types.
type Author = {
	name: string;
	avatar: string;
};

type Comment = {
	id: string;
	content: string;
	created_at: string;
	author: Author;
	likes: number;
	replies?: Comment[];
};

interface CommentNodeProps {
	comment: Comment;
	level?: number;
	openDrawer: (id: string) => void;
}

const CommentNode: React.FC<CommentNodeProps> = (
	{ comment, level = 0, openDrawer },
) => {
	// Expand first two levels by default
	const [isExpanded, setIsExpanded] = useState(level < 2);

	const handleToggleExpand = () => {
		if (comment.replies && comment.replies.length > 0) {
			setIsExpanded(!isExpanded);
		}
		// TODO: Implement asynchronous loading of comments if they are not already fetched.
		// This would require a new GraphQL query like getReplies(commentId: ID!).
	};

	const handleReply = () => {
		console.log("Replying to comment:", comment.id);
		openDrawer(comment.id);
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
				<Avatar
					src={comment.author.avatar}
					sx={{ width: 32, height: 32 }}
				/>
				<Box flex={1}>
					<Box display="flex" alignItems="center" gap={1}>
						<Typography
							variant="subtitle2"
							component="span"
							color="text.primary"
							fontWeight="bold"
						>
							{comment.author.name}
						</Typography>
						<Typography variant="caption" color="text.secondary">
							{new Date(comment.created_at).toLocaleString()}
						</Typography>
					</Box>
					<Typography variant="body2" mt={1}>
						{comment.content}
					</Typography>
					<Box className="w-full flex justify-end">
						<Box
							sx={{
								width: {
									xs: "75%",
									sm: "50%",
									md: "33%",
									lg: "30%",
									xl: "30%",
								},
							}}
						>
							<ReactionBar.Container
								onReply={handleReply}
								className="mt-2"
								size="small"
								fontSize="1.3rem"
							/>
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
						<CommentNode
							key={reply.id}
							comment={reply}
							level={level + 1}
							openDrawer={openDrawer}
						/>
					))}
				</Collapse>
			)}
		</Box>
	);
};

interface ReplyComponentsProps {
	bookListId: string;
}

export const TreeReplyComponents: React.FC<ReplyComponentsProps> = (
	{ bookListId },
) => {
	const commentId = bookListId; // TODO 暫時先用這個替代
	const createCommentListInput = {
		operation: "comment.list",
		parameter: {
			commentId: commentId || "",
		},
	};
	const { data, isLoading, error } = useSWR(createCommentListInput, apiPost);

	// currentReplyId
	const setDialogVisible = useDialogStore((state) => state.setDialogVisible);
	const [currentReplyId, setCurrentReplyId] = useState<string | null>(null);
	const [topLevelComments, setTopLevelComments] = useState<Comment[]>([]);

	useEffect(() => {
		// TODO Now we don't use the pagination, so we need to use the data directly
		try {
			if (data) {
				const arr: any = Object.values(data);
				setTopLevelComments(arr);
				console.log("topLevelComments", topLevelComments, "data", data);
			}
		} catch (_error) {
			console.error("Error setting top level comments");
		}
	}, [data]);

	const handleSubmit = (currentReplyId: string, content: string) => {
		console.log("handleSubmit", currentReplyId, content);
	};

	const openDrawer = (id: string) => {
		setCurrentReplyId(id);
		setDialogVisible(`reply-${id}`, true);
	};

	if (isLoading) return <p>Loading...</p>;
	if (error) return <p>Oh no... {String(error)}</p>;

	return (
		<>
			<Box p={2}>
				{topLevelComments.length > 0
					? (
						topLevelComments.map((comment: Comment) => (
							<CommentNode
								key={comment.id}
								comment={comment}
								openDrawer={openDrawer}
							/>
						))
					)
					: <p>No comments</p>}
			</Box>
			{/* 渲染 */}
			{currentReplyId && (
				<ReplyDrawer.Container
					dialogId={`reply-${currentReplyId}`}
					onSubmit={(content: string) =>
						handleSubmit(currentReplyId, content)}
				/>
			)}
		</>
	);
};

export default TreeReplyComponents;
