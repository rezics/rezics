import { create, parseAcceptLanguage } from "@nmnmcc/intee";
import { Languages } from "@rezics/i18n";
import Elysia from "elysia";

const matchTranslation = create(Languages);

export async function getTranslation(tags: readonly string[]) {
	const translation = matchTranslation([...tags]);
	return {
		data: await translation,
		locale: translation.locale.target,
	};
}

export function getRequestTranslation(headers?: Headers) {
	return getTranslation(parseAcceptLanguage(headers?.get("accept-language")));
}

export default new Elysia({ name: "i18n-context" }).derive({ as: "scoped" }, ({ request, set }) => {
	async function withContentLanguage(result: ReturnType<typeof getTranslation>) {
		const translation = await result;
		set.headers["content-language"] = translation.locale;
		return translation;
	}

	return {
		i18n: {
			getTranslation(tags: readonly string[]) {
				return withContentLanguage(getTranslation(tags));
			},
			getRequestTranslation() {
				return withContentLanguage(getRequestTranslation(request.headers));
			},
		},
	};
});
