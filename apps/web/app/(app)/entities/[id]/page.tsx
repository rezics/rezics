import { EntityDetailPage } from "@/features/entities/pages/entity-detail-page";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	return <EntityDetailPage id={(await params).id} />;
}
