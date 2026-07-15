import { ReviewEdit } from "@/features/reviews/reviews";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	return <ReviewEdit id={(await params).id} />;
}
