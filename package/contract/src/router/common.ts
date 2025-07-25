// common.ts
import { z } from "zod";
import { PhoneNumberUtil, PhoneNumberFormat } from "google-libphonenumber";

const phone_util = PhoneNumberUtil.getInstance();

// ---------------- Internationalization ----------------
export const countryList = [
    "CN",
    "US",
    "JP",
    "KR",
    "TW",
    "HK",
    "MO",
    "SG",
    "MY",
    "PH",
];
export const InternationalizedNameSchema = z.map(
    z.enum(countryList),
    z.string(),
);
export type InternationalizedName = z.infer<typeof InternationalizedNameSchema>;

// ---------------- Pagination ----------------
export const PaginationQuerySchema = z.object({
    page: z.coerce.number().int().optional().default(1),
    limit: z.coerce.number().int().optional().default(20),
    type: z
        .enum(["time", "name", "popular", "agree"])
        .optional()
        .default("time"),
    order: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const PaginatedResponse = <T extends z.ZodTypeAny>(item: T) =>
    z.object({
        items: z.array(item),
        page: z.number(),
        totalItems: z.number(),
        // itemNumberPerPage: z.number().default(100),
    });

// ---------------- Primitives ----------------
export const id = z.uuidv7().describe("ID");

// use https://github.com/ai/nanoid, 9 time, 12 random, 3 check
export const icsid = z
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

export const email = z.string().email().max(100).describe("email");

export const phone = z
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

export const password = z.string().min(6).max(24).describe("password");

// ---------------- Content Lengths ----------------
export const content = {
    short: z.string().min(1).max(1000).describe("short content"),
    medium: z.string().min(1).max(5000).describe("medium content"),
    long: z.string().min(1).max(100000).describe("long content"),
};

// ---------------- Timestamps ----------------
export const created_at = z.string().describe("ISO created timestamp");
export const updated_at = z.string().describe("ISO updated timestamp");

// ---------------- Thread ----------------
export const ThreadSchema = z.object({
    id: id,
    title: z.string(),
    status: z.string().optional(),
    created_at: created_at,
    updated_at: updated_at,
});

export type Thread = z.infer<typeof ThreadSchema>;
