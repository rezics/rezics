import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/notify/db/schema/index.ts",
  out: "./drizzle/notify",
  dbCredentials: {
    url: process.env.NOTIFY_DATABASE_URL ?? "",
  },
});
