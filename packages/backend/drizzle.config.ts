import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/services/database/schema/all.ts",
  out: "./drizzle",
});
