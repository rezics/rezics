import { ConsoleUsersPage } from "@/features/console/pages/console-users-page";

export default async function Page({ params }: { readonly params: Promise<{ userId: string }> }) {
	return <ConsoleUsersPage selectedUserId={(await params).userId} />;
}
