export function postHref(postId: string, realmId?: string, hash?: string): string {
	const query = realmId ? `?realmId=${encodeURIComponent(realmId)}` : "";
	return `/posts/${postId}${query}${hash ? `#${hash}` : ""}`;
}
