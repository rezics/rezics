import {
	CollectionManagementSectionIds,
	type CollectionManagementSectionId,
} from "../model/collection-management-section";

export function collectionHref(collectionId: string): string {
	return `/collections/${collectionId}`;
}

export function collectionManagementHref(collectionId: string): string {
	return `${collectionHref(collectionId)}/edit`;
}

export function collectionManagementSectionHref(
	collectionId: string,
	sectionId: CollectionManagementSectionId,
): string {
	return `${collectionManagementHref(collectionId)}/${sectionId}`;
}

export function parseCollectionManagementSection(
	pathname: string,
	collectionId: string,
): CollectionManagementSectionId | undefined {
	const base = collectionManagementHref(collectionId);
	if (pathname === base || pathname === `${base}/`) return undefined;
	return CollectionManagementSectionIds.find(
		(sectionId) =>
			pathname === `${base}/${sectionId}` || pathname.startsWith(`${base}/${sectionId}/`),
	);
}
