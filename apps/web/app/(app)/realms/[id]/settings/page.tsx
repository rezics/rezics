import { RealmSettingsPage } from "@/features/realms/realm-settings";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	return <RealmSettingsPage id={(await params).id} />;
}
