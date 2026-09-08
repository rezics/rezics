import { z } from "zod";
import { notFound } from "next/navigation";
import { SourceJobPage } from "@/features/catalog-sources/pages/source-job-page";
export default async function Page({
	params,
}: {
	params: Promise<{ sourceRecordId: string; jobId: string }>;
}) {
	const parsed = z.object({ sourceRecordId: z.uuid(), jobId: z.uuid() }).safeParse(await params);
	if (!parsed.success) notFound();
	return <SourceJobPage {...parsed.data} />;
}
