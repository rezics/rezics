// common.ts
import { z, ZodObject } from "zod";
import { PhoneNumberUtil, PhoneNumberFormat } from "google-libphonenumber";

const phone_util = PhoneNumberUtil.getInstance();

export const id = z.uuidv4().describe("ID");

export const shortString = z.string().max(100);
export const longString = z.string().max(10000);

export const Pagination = <TRead extends ZodObject, TItem extends ZodObject>(
    read: TRead,
    item: TItem,
) => {
    const Read = z.object({
        ...read.shape,
        page: z.int(),
        limit: z.int(),
        type: z.string(),
        order: z.enum(["asc", "desc"]),
    });

    const View = z.object({
        items: z.array(item),
        page: z.number(),
        totalItems: z.number(),
    });

    return {
        Read,
        View,
    };
};

export const icsId = z
    .string()
    .regex(/^BK-[a-zA-Z0-9]{24}$/, {
        message:
            "ICSID must start with 'BK' followed by 24 alphanumeric characters.",
    })
    .describe("ICSID");

export const username = z
    .string()
    .min(3)
    .max(27)
    .regex(/^[a-zA-Z0-9_]+$/, "Only alphanumeric and underscore")
    .describe("username");

export const email = z.email().describe("email");

export const phoneNumber = z
    .string()
    .min(4)
    .max(16)
    .refine((v) => {
        try {
            phone_util.parse(v);
            return true;
        } catch {
            return false;
        }
    }, "Invalid phone number")
    .transform((v) =>
        phone_util.format(phone_util.parse(v), PhoneNumberFormat.E164),
    )
    .describe("phone number");

export const password = z.string().min(8).max(27).describe("password");

export const Auditable = z.object({
    created_at: z.date(),
    updated_at: z.date(),
});

export const Nameable = z.object({
    name: shortString,
});

export const Tagable = z.object({
    tags: z.array(z.string()),
});

export const Evaluable = z.object({
    up: z.array(id),
    down: z.array(id),
    favorites: z.array(id),
});
