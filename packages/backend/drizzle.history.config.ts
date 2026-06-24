import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/history/db/schema/index.ts",
  out: "./drizzle/history",
  dbCredentials: {
    url: process.env.HISTORY_DATABASE_URL ?? "",
  },
});
