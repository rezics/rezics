import { Reader } from "@/features/units/reader";

export default async function Page({
	params,
}: {
	params: Promise<{ unit: string; nodeId: string }>;
}) {
	const { unit, nodeId } = await params;
	return <Reader bookId={unit} nodeId={nodeId} />;
}
