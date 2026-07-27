import { CollectionDetailPage } from "@/features/collections/pages/collection-detail-page";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	return <CollectionDetailPage collectionId={(await params).id} />;
}
