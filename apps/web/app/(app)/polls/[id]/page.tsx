import { PollDetail } from "@/features/polls/polls";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	return <PollDetail id={(await params).id} />;
}
