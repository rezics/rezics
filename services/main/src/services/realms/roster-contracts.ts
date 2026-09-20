import { z } from "zod";

/** Public Entity presentation shares the native roster's opaque continuation and fixed work bound. @alpha */
export const PublicRealmRosterQuerySchema = z.strictObject({
	afterId: z.string().max(512).optional(),
	localizationLanguages: z.array(z.string().max(64)).max(16).optional(),
});
