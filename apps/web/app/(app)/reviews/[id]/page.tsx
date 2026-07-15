import { ReviewDetail } from "@/features/reviews/reviews";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	return <ReviewDetail id={(await params).id} />;
}
