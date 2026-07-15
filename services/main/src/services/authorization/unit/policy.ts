export function isPubliclyReadableUnit(status: string, visibility: string) {
	return status === "published" && ["public", "unlisted"].includes(visibility);
}
