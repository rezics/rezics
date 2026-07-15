import { ProfilePage } from "@/features/profiles/profile-page";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	return <ProfilePage id={(await params).id} />;
}
