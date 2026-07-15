import { RealmDetailPage } from "@/features/realms/realm-pages";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	return <RealmDetailPage id={(await params).id} />;
}
