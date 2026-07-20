import { ZonePage } from "@/features/zones/zone-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	return <ZonePage id={(await params).id} />;
}
