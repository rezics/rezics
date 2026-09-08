"use client";
import { CatalogResourcePage } from "@/features/catalog/catalog-resource-page";
import { EntityResourceDetails } from "../components/entity-resource-details";
export function EntityDetailPage({ id }: { readonly id: string }) {
	return (
		<CatalogResourcePage reference={{ owner: "entity", id }}>
			<EntityResourceDetails id={id} />
		</CatalogResourcePage>
	);
}
