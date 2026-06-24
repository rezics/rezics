import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/reaction/db/schema/index.ts",
  out: "./drizzle/reaction",
  dbCredentials: {
    url: process.env.REACTION_DATABASE_URL ?? "",
  },
});
