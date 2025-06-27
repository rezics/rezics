import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-plugin-prettier";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

// 基础配置
const baseConfig = {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
        "@typescript-eslint": tseslint.plugin,
        prettier: prettier,
    },
    languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
        },
    },
    rules: {
        "@typescript-eslint/no-unused-vars": "warn",
        "prettier/prettier": "error",
    },
};

// 前端配置
const frontendConfig = {
    files: ["package/app/**/*.{js,jsx,ts,tsx}"],
    plugins: {
        react: reactPlugin,
        "react-hooks": reactHooksPlugin,
    },
    languageOptions: {
        parserOptions: {
            ecmaFeatures: {
                jsx: true,
            },
        },
    },
    rules: {
        "react/react-in-jsx-scope": "off",
        "react-hooks/rules-of-hooks": "error"
    },
    settings: {
        react: {
            version: "detect",
        },
    },
};

// 后端配置
const backendConfig = {
    files: ["package/server/**/*.{js,ts}"],
    rules: {
        // 后端特定的规则
        "no-console": "warn",
    },
};

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    baseConfig,
    frontendConfig,
    backendConfig,
);
