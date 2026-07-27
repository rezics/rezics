import {
	postApiSearchFeaturesByTemplateExecute,
	type PostApiSearchFeaturesByTemplateExecuteBody,
	type PostApiSearchFeaturesByTemplateExecuteStatus200,
} from "@rezics/openapi-tanstack-query";

export const ProfileContentCategories = ["entity", "posts", "reviews", "collections"] as const;
export type ProfileContentCategory = (typeof ProfileContentCategories)[number];
export type ProfileContentHit =
	PostApiSearchFeaturesByTemplateExecuteStatus200["groups"][number]["hits"][number];

const ProfileContentPageSize = 10;

export async function fetchProfileContentPage({
	cursor,
	profileId,
	signal,
}: {
	readonly cursor?: string;
	readonly profileId: string;
	readonly signal?: AbortSignal;
}): Promise<PostApiSearchFeaturesByTemplateExecuteStatus200> {
	const state = {
		pageSize: ProfileContentPageSize,
		sort: "updatedAt:desc",
		...(cursor ? { cursor } : {}),
	} satisfies PostApiSearchFeaturesByTemplateExecuteBody["state"];
	const { data } = await postApiSearchFeaturesByTemplateExecute({
		path: { template: "global" },
		body: {
			contexts: [{ kind: "profile", profileId }],
			injections: [],
			state,
		},
		signal,
		throwOnError: true,
	});
	return data;
}
