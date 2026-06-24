import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/schema.ts",
  out: "./drizzle/server",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
