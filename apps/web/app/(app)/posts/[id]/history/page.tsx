import { PostHistoryPage } from "@/features/posts/post-history";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	return <PostHistoryPage postId={(await params).id} />;
}
