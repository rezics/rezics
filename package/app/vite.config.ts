import "dotenv/config";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { pipe } from "effect/Function";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [tailwindcss() as any, react()],
    server: {
        port: 35001,
    },
    resolve: {
        alias: {
            "@": resolve(__dirname, "./src"),
            "@component": resolve(__dirname, "./src/component"),
            "@page": resolve(__dirname, "./src/page"),
            "@util": resolve(__dirname, "./src/util"),
            "@locale": resolve(__dirname, "./src/locale/index.ts"),
        },
    },
    define: {
        "process.env": pipe(
            Object.entries(process.env).filter(([key]) => key.startsWith("ICS")),
            Object.fromEntries,
        ),
    },
});
