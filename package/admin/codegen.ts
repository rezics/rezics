// codegen.ts
import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
    schema: "./src/mocks/schema.graphql",
    documents: ["src/graphql/**/*.ts"], // 你的 gql 查询语句位置
    generates: {
        "./src/graphql/generated.ts": {
            plugins: [
                "typescript", // 生成基础类型
                "typescript-operations", // 针对 operation 生成变量、返回值类型
                "typescript-msw", // 生成 MSW 支持的 GraphQL 文档（如 GetBooksDocument）
            ],
        },
    },
    overwrite: true,
    emitLegacyCommonJSImports: false,
};

export default config;
