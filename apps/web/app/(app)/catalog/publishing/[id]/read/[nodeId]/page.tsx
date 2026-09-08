import { Reader } from "@/features/units/reader";

export default async function Page({
	params,
}: {
	params: Promise<{ id: string; nodeId: string }>;
}) {
	const { id, nodeId } = await params;
	return <Reader bookId={id} nodeId={nodeId} />;
}
