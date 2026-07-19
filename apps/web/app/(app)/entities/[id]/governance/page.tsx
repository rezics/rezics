import { EntityGovernancePage } from "@/features/governance/unit-workflows";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	return <EntityGovernancePage id={(await params).id} />;
}
