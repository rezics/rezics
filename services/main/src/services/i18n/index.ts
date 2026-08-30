import Elysia from "elysia";
import { create, parseAcceptLanguage, type NamespaceSelection } from "native-i18n";
import { serviceResources } from "@rezics/i18n/service-resources";

const nativeI18n = create(serviceResources);
type Selection = NamespaceSelection<typeof serviceResources>;

export async function getTranslation<const Selected extends Selection>(
	selection: Selected,
	tags: readonly string[],
) {
	const translation = await nativeI18n.getTranslation(selection, tags);
	return {
		data: translation.data,
		t: translation.t,
		locale: translation.locale.current,
	};
}

export function getRequestTranslation<const Selected extends Selection>(
	selection: Selected,
	headers?: Headers,
) {
	return getTranslation(selection, parseAcceptLanguage(headers?.get("accept-language")));
}

type ServiceTranslation<Selected extends Selection> = Awaited<
	ReturnType<typeof getTranslation<Selected>>
>;

export default new Elysia({ name: "i18n-context" }).derive("plugin", ({ request, set }) => {
	async function withContentLanguage<Selected extends Selection>(
		result: Promise<ServiceTranslation<Selected>>,
	) {
		const translation = await result;
		set.headers["content-language"] = translation.locale;
		return translation;
	}

	return {
		i18n: {
			getTranslation<const Selected extends Selection>(
				selection: Selected,
				tags: readonly string[],
			) {
				return withContentLanguage(getTranslation(selection, tags));
			},
			getRequestTranslation<const Selected extends Selection>(selection: Selected) {
				return withContentLanguage(getRequestTranslation(selection, request.headers));
			},
		},
	};
});
