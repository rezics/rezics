import { PostEditPage } from "@/features/posts/post-pages";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	return <PostEditPage id={(await params).id} />;
}
