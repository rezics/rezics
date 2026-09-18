import { defineConfig } from "drizzle-kit";

// Production migrations are composed only by services/main's migration owner.
export default defineConfig({ dialect: "postgresql", schema: "./src/postgres/index.ts", out: "../../.temp/schema-preview-migrations" });
