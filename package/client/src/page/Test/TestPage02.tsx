import React, { useState } from "react";
import { tsr } from "@/api/tsr";

export function TestPage02() {
	// 查询 posts

	const POSTS_QUERY_KEY = ["posts", "0"];

	const { data, isLoading, error } = tsr.posts.list.useQuery({
		queryKey: POSTS_QUERY_KEY,
		queryData: {
			query: {
				page: 1,
				limit: 10,
			},
		},
	});

	// 更新 post
	const updateMutation = tsr.posts.update.useMutation();
	const [updateId, setUpdateId] = useState("");
	const [newTitle, setNewTitle] = useState("");

	if (isLoading) return <div>Loading...</div>;
	if (error) {
		// ts-rest error 可能为 Error 或 { body }
		const msg = error instanceof Error
			? error.message
			: error && typeof error === "object" && "body" in error
			? JSON.stringify(error.body)
			: String(error);
		return <div>Error: {msg}</div>;
	}

	return (
		<div>
			<h2>Post List</h2>
			<ul>
				{data?.items?.map((post: any) => (
					<li key={post.id}>
						{post.title} (id: {post.id})
					</li>
				))}
			</ul>

			<h2>Update Post</h2>
			<input
				placeholder="Post ID"
				value={updateId}
				onChange={(e) => setUpdateId(e.target.value)}
			/>
			<input
				placeholder="New Title"
				value={newTitle}
				onChange={(e) => setNewTitle(e.target.value)}
			/>
			<button
				onClick={() => {
					updateMutation.mutate({
						params: { id: updateId },
						body: { title: newTitle },
					});
				}}
			>
				Update
			</button>
			{updateMutation.isPending && <div>Updating...</div>}
			{updateMutation.error && (
				<div>
					Error: {updateMutation.error instanceof Error
						? updateMutation.error.message
						: updateMutation.error &&
								typeof updateMutation.error === "object" &&
								"body" in updateMutation.error
						? JSON.stringify(updateMutation.error.body)
						: String(updateMutation.error)}
				</div>
			)}
			{updateMutation.data && <div>Update Success!</div>}
		</div>
	);
}
