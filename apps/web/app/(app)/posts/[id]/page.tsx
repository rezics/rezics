import { PostDetailPage } from "@/features/posts/post-pages";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	return <PostDetailPage id={(await params).id} />;
}
