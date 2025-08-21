import js from "npm:@eslint/js";
import tsPlugin from "npm:@typescript-eslint/eslint-plugin";
import tsParser from "npm:@typescript-eslint/parser";
import reactRefresh from "npm:eslint-plugin-react-refresh";

export default [
    // JS 基础规则
    js.configs.recommended,

    // TS 配置
    {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                sourceType: "module",
                ecmaVersion: "latest",
            },
        },
        plugins: {
            "@typescript-eslint": tsPlugin,
        },
        rules: {
            ...tsPlugin.configs.recommended.rules, // 启用 @typescript-eslint 推荐规则
        },
    },

    // React Refresh 配置
    {
        files: ["**/*.{jsx,tsx}"],
        plugins: {
            "react-refresh": reactRefresh,
        },
        rules: {
            "react-refresh/only-export-components": "error",
        },
    },
];
