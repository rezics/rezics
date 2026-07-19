import { EntityEditPage } from "@/features/catalog/catalog-pages";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	return <EntityEditPage id={(await params).id} />;
}
