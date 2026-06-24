import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/ranking/db/schema/index.ts",
  out: "./drizzle/ranking",
  dbCredentials: {
    url: process.env.RANKING_DATABASE_URL ?? "",
  },
});
