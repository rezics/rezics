import "dotenv/config";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { pipe } from "fp-ts/lib/function";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [tailwindcss() as any, react()],
    server: {
        port: 35001,
    },
    define: {
        "process.env": pipe(
            Object.entries(process.env).filter(([key]) => key.startsWith("ICS")),
            Object.fromEntries,
        ),
    },
});
