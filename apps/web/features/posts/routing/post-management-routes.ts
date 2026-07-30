import type { PostManagementSectionId } from "../model/post-management-section";

export function postDetailHref(postId: string): string {
	return `/posts/${encodeURIComponent(postId)}`;
}

export function postManagementHref(postId: string): string {
	return `${postDetailHref(postId)}/edit`;
}

export function postManagementSectionHref(
	postId: string,
	sectionId: PostManagementSectionId,
): string {
	const base = postManagementHref(postId);
	return sectionId === "main" ? base : `${base}/${sectionId}`;
}

export function parsePostManagementSection(
	pathname: string,
	postId: string,
): PostManagementSectionId | undefined {
	const base = postManagementHref(postId);
	if (pathname === base || pathname === `${base}/`) return "main";
	if (pathname === `${base}/attributions`) return "attributions";
	if (pathname === `${base}/realms`) return "realms";
	if (pathname === `${base}/access`) return "access";
	if (pathname === `${base}/history` || pathname.startsWith(`${base}/history/`)) return "history";
	return undefined;
}
