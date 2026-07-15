import { CollectionEdit } from "@/features/collections/collections";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	return <CollectionEdit id={(await params).id} />;
}
