import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	plugins: [
		inferAdditionalFields({
			user: {
				registrationContentLanguage: {
					type: ["zh", "en"],
					required: false,
					defaultValue: "en",
					input: true,
					returned: false,
				},
			},
		}),
	],
});

export type AuthSession = (typeof authClient)["$Infer"]["Session"];
export type AuthSessionSnapshot = ReturnType<typeof authClient.useSession>;
