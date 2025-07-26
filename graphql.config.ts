import type { IGraphQLConfig, SchemaPointer } from "graphql-config";
import type { CodegenConfig } from "@graphql-codegen/cli";
import "dotenv/config";

const schema: SchemaPointer = {
    "https://library--rezics.c-83.i.aws.edgedb.cloud/branch/dev/graphql": {
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env["TOKEN"]}`,
        },
    },
};

const config: IGraphQLConfig = {
    projects: {
        client: {
            schema,
            documents: ["./package/client/src/**/*.{ts,tsx}"],
            extensions: {
                codegen: {
                    generates: {
                        "./package/client/src/gql/": {
                            preset: "client",
                        },
                    },
                } satisfies CodegenConfig,
            },
        },
        server: {
            schema,
            documents: "./package/server/src/**/*.ts",
            extensions: {
                codegen: {
                    generates: {
                        "./package/server/src/gql/": {
                            preset: "graphql-modules",
                        },
                    },
                } satisfies CodegenConfig,
            },
        },
    },
};

export default config;
