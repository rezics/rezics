import { notFound } from "next/navigation";
import { z } from "zod";
import { CatalogDefinitionPage } from "@/features/catalog-definitions/pages/catalog-definitions-page";
export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ revision?: string | string[] }>;
}) {
	const { id } = await params,
		query = await searchParams;
	if (
		!z.uuid().safeParse(id).success ||
		(query.revision !== undefined &&
			(typeof query.revision !== "string" || !z.uuid().safeParse(query.revision).success))
	)
		notFound();
	return <CatalogDefinitionPage id={id} revisionId={query.revision} />;
}
