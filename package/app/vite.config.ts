import "dotenv/config";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { autoImportPlugin } from './src/config/auto-import';
import { pipe } from "fp-ts/lib/function";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        tailwindcss() as any, 
        react(),
        autoImportPlugin
    ],
    server: {
        port: 35001,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    },
    define: {
        "process.env": pipe(
            Object.entries(process.env).filter(([key]) => key.startsWith("ICS")),
            Object.fromEntries,
        ),
    },
});
