// eslint.config.js (Flat Config, ESM)
import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

// 通用忽略（Flat Config 要用 ignores 字段）
export default [
    {
        ignores: [
            "**/node_modules/**",
            "**/dist/**",
            "**/build/**",
            "**/.vite/**",
            "**/.next/**",
            "**/coverage/**",
            "**/*.min.*",
            "**/*.lock",
        ],
    },

    // JS 基础
    js.configs.recommended,

    // TypeScript（基础，不做类型流分析，性能更好）
    {
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                sourceType: "module",
                ecmaVersion: "latest",
                // 如果你不做类型流分析，这里无需 project/tsconfig
            },
        },
        plugins: {
            "@typescript-eslint": tsPlugin,
        },
        rules: {
            // 启用 TS 推荐规则（不涉类型流分析）
            ...tsPlugin.configs.recommended.rules,

            // --- 务实微调（常见诉求） ---
            // 允许临时 any（给警告，不让 CI 挂）
            "@typescript-eslint/no-explicit-any": "off",

            // 用 TS 版本的未使用变量检测，并允许下划线占位
            "no-unused-vars": "off", // 关闭 JS 版
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrors: "none",
                    ignoreRestSiblings: true,
                },
            ],

            // 可按需开启/调整的建议（保持理性，不做过度规训）
            "@typescript-eslint/consistent-type-imports": ["warn", { prefer: "type-imports" }],
            "@typescript-eslint/no-non-null-assertion": "off", // 允许 x! 在 UI 代码里偶尔使用
        },
    },

    // React 基础 + Hooks + a11y + Fast Refresh
    reactRefresh.configs.vite,

    {
        files: ["**/*.{jsx,tsx}"],
        plugins: {
            react,
            "react-hooks": reactHooks,
            "jsx-a11y": jsxA11y,
        },
        languageOptions: {
            parser: tsParser, // 统一用一个 parser 处理 TSX/JSX
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                ecmaFeatures: { jsx: true },
            },
        },
        settings: {
            // 让 eslint-plugin-react 自动识别 React 版本（新旧 JSX runtime 都兼容）
            react: { version: "detect" },
        },
        rules: {
            // React 一般性建议
            ...react.configs.recommended.rules,

            // React Hooks 强制约束（必须！）
            ...reactHooks.configs.recommended.rules,

            // 无障碍（产品向项目强烈建议）
            ...jsxA11y.configs.recommended.rules,

            // eslint-plugin-react config
            "react/react-in-jsx-scope": "off",
            "react/jsx-uses-react": "off",

            // 少量语义化微调（可按团队口味增删）
            "react/self-closing-comp": "warn",
            "react/jsx-no-useless-fragment": ["warn", { allowExpressions: true }],
        },
    },

    // 浏览器环境
    {
        files: ["**/*.{js,ts,jsx,tsx}"],
        languageOptions: {
            globals: {
                ...globals.browser, // 浏览器全局
                ...globals.es2021, // ES2021 全局（可选）
            },
        },
    },
];
