import {
	AccessManagementPermissionValues,
	PlatformCapabilityValues,
	UnitPermissionValues,
} from "@rezics/access";
import { z } from "zod";

/** Registry-qualified permission references; family is never inferred from a shared spelling. @internal */
export const AccessPermissionSchema = z.discriminatedUnion("family", [
	z.strictObject({ family: z.literal("unit"), key: z.enum(UnitPermissionValues) }),
	z.strictObject({ family: z.literal("platform"), key: z.enum(PlatformCapabilityValues) }),
	z.strictObject({
		family: z.literal("management"),
		key: z.enum(AccessManagementPermissionValues),
	}),
]);
