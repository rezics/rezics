export function canListAllOwnedCollections({
	ownerId,
	viewerId,
}: {
	ownerId: string | undefined;
	viewerId: string | undefined;
}): boolean {
	return ownerId !== undefined && ownerId === viewerId;
}
