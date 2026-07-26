import type { PostManagementSectionId } from "../model/post-management-section";

export type PostManagementResourceKind = "post" | "review";

function resourceSegment(kind: PostManagementResourceKind): "posts" | "reviews" {
	return kind === "post" ? "posts" : "reviews";
}

export function postDetailHref(kind: PostManagementResourceKind, postId: string): string {
	return `/${resourceSegment(kind)}/${postId}`;
}

export function postManagementHref(kind: PostManagementResourceKind, postId: string): string {
	return `${postDetailHref(kind, postId)}/edit`;
}

export function postManagementSectionHref(
	kind: PostManagementResourceKind,
	postId: string,
	sectionId: PostManagementSectionId,
): string {
	const base = postManagementHref(kind, postId);
	return sectionId === "main" ? base : `${base}/${sectionId}`;
}

export function parsePostManagementSection(
	pathname: string,
	kind: PostManagementResourceKind,
	postId: string,
): PostManagementSectionId | undefined {
	const base = postManagementHref(kind, postId);
	if (pathname === base || pathname === `${base}/`) return "main";
	if (pathname === `${base}/attributions`) return "attributions";
	if (pathname === `${base}/access`) return "access";
	if (pathname === `${base}/history` || pathname.startsWith(`${base}/history/`)) return "history";
	return undefined;
}
