import type { ReactNode } from "react";

import { PostManagementWorkspace } from "@/features/posts/components/post-management-workspace";

export default async function PostEditLayout({
	children,
	params,
}: {
	children: ReactNode;
	params: Promise<{ id: string }>;
}) {
	return <PostManagementWorkspace postId={(await params).id}>{children}</PostManagementWorkspace>;
}
