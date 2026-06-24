import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/auth/db/schema/index.ts",
  out: "./drizzle/auth",
  dbCredentials: {
    url: process.env.AUTH_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
  },
});
