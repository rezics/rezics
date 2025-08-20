import { defineConfig } from "drizzle-kit";

export default defineConfig({
    dialect: "gel",
    schema: "./drizzle/schema/*",
    strict: true,
});
