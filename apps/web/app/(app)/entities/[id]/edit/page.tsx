import { EntityEditPage } from "@/features/units/unit-resource-pages";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	return <EntityEditPage id={(await params).id} />;
}
