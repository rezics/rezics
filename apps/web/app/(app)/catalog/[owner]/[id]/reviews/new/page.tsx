import { notFound } from "next/navigation";
import { CatalogReferenceSchema } from "@rezics/reference";
import { TargetedReviewCreatePage } from "@/features/reviews/pages/targeted-review-create-page";
export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ owner: string; id: string }>;
	searchParams: Promise<{ progressEntryId?: string }>;
}) {
	const reference = CatalogReferenceSchema.safeParse(await params);
	if (!reference.success) notFound();
	const { progressEntryId } = await searchParams;
	if (
		progressEntryId !== undefined &&
		!CatalogReferenceSchema.shape.id.safeParse(progressEntryId).success
	)
		notFound();
	return (
		<TargetedReviewCreatePage
			type={reference.data.owner}
			targetId={reference.data.id}
			progressEntryId={progressEntryId}
		/>
	);
}
