import { z } from "zod";
import { PhoneNumberUtil, PhoneNumberFormat } from "google-libphonenumber";

// ------------------------------------------------------------------
// User
// ------------------------------------------------------------------

export const UserSchema = z.object({
    id: z.string(),
    name: z.string(),
    // avatar: z.string().url().optional(),
    avatar: z.string().url(),
});
export type User = z.infer<typeof UserSchema>;

// ------------------------------------------------------------------
// Pagination helper
// ------------------------------------------------------------------

export const PaginationQuerySchema = z.object({
    page: z.number().int().optional().default(1),
    limit: z.number().int().optional().default(20),
});

export const PaginatedResponse = <T extends z.ZodTypeAny>(item: T) =>
    z.object({
        items: z.array(item),
        page: z.number(),
        totalPages: z.number(),
        total: z.number(),
    });

const phone_util = PhoneNumberUtil.getInstance();

export const username = z.string().min(3).max(27).describe("username");

export const email = z.email().max(100).describe("email");

export const phone = z
    .string()
    .min(4)
    .max(16)
    .refine((value) => {
        try {
            phone_util.parse(value);
            return true;
        } catch {
            return false;
        }
    }, "Invalid phone number")
    .transform((value) => phone_util.format(phone_util.parse(value), PhoneNumberFormat.E164))
    .describe("phone number");

export const password = z.string().min(6).max(24).describe("password");

export const id = z.uuidv4().describe("ID");

export const content = {
    short: z.string().min(1).max(1000).describe("short content"),
    medium: z.string().min(1).max(1000).describe("medium content"),
    long: z.string().min(1).max(100000).describe("long content"),
};

export const updated_at = z.date().describe("updated at");
export const created_at = z.date().describe("created at");
