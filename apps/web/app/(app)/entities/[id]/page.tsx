import { EntityDetailPage } from "@/features/catalog/catalog-pages";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	return <EntityDetailPage id={(await params).id} />;
}
