import type { ContentLanguage } from "@rezics/i18n";

interface PresentationAttribution {
	readonly role: string;
	readonly creditedUnit: { readonly title: string | null };
}

interface PresentationSubject {
	readonly title: string | null;
}

interface PostPresentationTitleInput {
	readonly title?: string | null;
	readonly language?: ContentLanguage | null;
	readonly postKind: string;
	readonly attributions: readonly PresentationAttribution[];
	readonly subject?: PresentationSubject | null;
}

interface PostPresentationTitleMessages {
	readonly postBy: (input: { author: string }) => string;
	readonly reviewOf: (input: { author: string; subject: string }) => string;
	readonly reply: string;
	readonly unknownAttribution: string;
	readonly unnamedSubject: string;
	readonly untitled: string;
}

export interface ResolvedPostPresentationTitle {
	readonly language?: ContentLanguage;
	readonly value: string;
}

function presentationAuthor(
	attributions: readonly PresentationAttribution[],
	unknownAttribution: string,
) {
	const attribution = attributions.find(({ role }) => role === "publisher") ?? attributions[0];
	return attribution?.creditedUnit.title?.trim() || unknownAttribution;
}

export function resolvePostPresentationTitle(
	post: PostPresentationTitleInput,
	messages: PostPresentationTitleMessages,
): ResolvedPostPresentationTitle {
	const authoredTitle = post.title?.trim();
	if (authoredTitle)
		return {
			...(post.language ? { language: post.language } : {}),
			value: authoredTitle,
		};
	if (post.postKind === "reply") return { value: messages.reply };

	const author = presentationAuthor(post.attributions, messages.unknownAttribution);
	if (post.postKind === "post") return { value: messages.postBy({ author }) };
	if (post.postKind === "review")
		return {
			value: messages.reviewOf({
				author,
				subject: post.subject?.title?.trim() || messages.unnamedSubject,
			}),
		};
	return { value: messages.untitled };
}
