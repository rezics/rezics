import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { ContentLanguageValues, DefaultPreferredLanguage } from "@rezics/i18n";

export const authClient = createAuthClient({
	plugins: [
		inferAdditionalFields({
			user: {
				registrationContentLanguage: {
					type: [...ContentLanguageValues],
					required: false,
					defaultValue: DefaultPreferredLanguage,
					input: true,
					returned: false,
				},
			},
		}),
	],
});

export type AuthSession = (typeof authClient)["$Infer"]["Session"];
export type AuthSessionSnapshot = ReturnType<typeof authClient.useSession>;
