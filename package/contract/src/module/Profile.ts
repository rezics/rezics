import { z } from "zod";

export const Profile = z.object({
    avatar: z.url().describe("profile avatar URL"),
    name: z.string().min(3).max(42).describe("profile name"),
    description: z.string().max(1000).optional().describe("profile description"),
});
