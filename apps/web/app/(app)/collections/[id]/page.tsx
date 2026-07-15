import { CollectionDetail } from "@/features/collections/collections";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	return <CollectionDetail id={(await params).id} />;
}
